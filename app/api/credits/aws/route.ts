import { NextResponse } from "next/server";
import type { ProviderData } from "@/lib/types";
import { utilizationStatus } from "@/lib/utils";
import { createHmac, createHash } from "crypto";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = process.env.AWS_SESSION_COOKIE?.trim();
const IAM_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim();
const IAM_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim();

// --- AWS SigV4 helpers ---
function sha256hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(Buffer.from("AWS4" + secretKey), date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

interface AwsCreds {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

async function getTemporaryCreds(): Promise<AwsCreds> {
  const res = await fetch("https://us-east-1.console.aws.amazon.com/api/prod/browserCreds", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "*/*",
      "x-web-client-version": "2.14.2",
      "x-widget-stage": "prod",
      Cookie: SESSION_COOKIE!,
      Origin: "https://us-east-1.console.aws.amazon.com",
      Referer: "https://us-east-1.console.aws.amazon.com/costmanagement/home",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
    body: "",
    cache: "no-store",
  });

  if (!res.ok) {
    await res.text();
    throw new Error(`AWS Auth Failed (${res.status}): Please refresh AWS Console and update cookies.`);
  }
  const json = await res.json();

  if (!json.accessKeyId) throw new Error("AWS Session expired: No accessKeyId returned");
  return json as AwsCreds;
}

async function getFreeTierCredits(creds: AwsCreds): Promise<number> {
  const region = "us-east-1";
  const service = "freetier";
  const host = `${service}.${region}.api.aws`;
  const endpoint = `https://${host}/`;
  const target = "AWSFreeTierService.GetAccountPlanState";
  const body = "{}";

  // Build date/time strings
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const bodyHash = sha256hex(body);

  const canonicalHeadersList = [
    `content-type:application/x-amz-json-1.0`,
    `host:${host}`,
    `x-amz-content-sha256:${bodyHash}`,
    `x-amz-date:${amzDate}`,
    ...(creds.sessionToken ? [`x-amz-security-token:${creds.sessionToken}`] : []),
    `x-amz-target:${target}`,
  ];
  const canonicalHeaders = canonicalHeadersList.join("\n") + "\n";

  const signedHeaders = [
    "content-type",
    "host",
    "x-amz-content-sha256",
    "x-amz-date",
    ...(creds.sessionToken ? ["x-amz-security-token"] : []),
    "x-amz-target",
  ].join(";");

  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(creds.secretAccessKey, dateStamp, region, service);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authHeader = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.0",
      "x-amz-content-sha256": bodyHash,
      "x-amz-date": amzDate,
      ...(creds.sessionToken ? { "x-amz-security-token": creds.sessionToken } : {}),
      "x-amz-target": target,
      Authorization: authHeader,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      Origin: "https://us-east-1.console.aws.amazon.com",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("AWS FreeTier API request failed", { status: res.status });
    throw new Error(`AWS FreeTier API error: ${res.status}`);
  }
  const json = await res.json();

  const amount = json?.accountPlanRemainingCredits?.amount;
  if (typeof amount !== "number") throw new Error("Unexpected AWS response: Credit info missing");
  return amount;
}

export async function GET() {
  const hasIamCreds = IAM_ACCESS_KEY_ID && IAM_SECRET_ACCESS_KEY;

  if (!hasIamCreds && !SESSION_COOKIE) {
    return NextResponse.json(
      {
        id: "aws",
        name: "Amazon Bedrock",
        type: "credits",
        status: "error",
        error: "AWS credentials missing: set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (recommended) or AWS_SESSION_COOKIE in .env.local",
        lastUpdated: new Date().toISOString(),
      } as ProviderData,
      { status: 200 }
    );
  }

  try {
    const creds: AwsCreds = hasIamCreds
      ? { accessKeyId: IAM_ACCESS_KEY_ID!, secretAccessKey: IAM_SECRET_ACCESS_KEY! }
      : await getTemporaryCreds();
    const totalUsd = await getFreeTierCredits(creds);

    // If we have credits, show them as 100% available if near the limit
    // Typically these grants are exactly 200, 300, or 1000.
    const knownGrants = [200, 300, 500, 1000];
    const totalGrantedUsd = knownGrants.find(g => g >= totalUsd) || totalUsd;
    const usedPct = totalGrantedUsd > 0 ? Math.max(0, ((totalGrantedUsd - totalUsd) / totalGrantedUsd) * 100) : 0;

    const provider: ProviderData = {
      id: "aws",
      name: "Amazon Bedrock",
      type: "credits",
      status: utilizationStatus(usedPct),
      creditsRemaining: totalUsd,
      creditsTotal: totalGrantedUsd,
      currency: "USD",
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(provider);
  } catch (err) {
    console.error("AWS route failed", {
      message: err instanceof Error ? err.message : "Unknown upstream error",
    });
    return NextResponse.json(
      {
        id: "aws",
        name: "Amazon Bedrock",
        type: "credits",
        status: "error",
        error: "Failed to fetch AWS Bedrock credits. Check server logs and credentials.",
        lastUpdated: new Date().toISOString(),
      } as ProviderData,
      { status: 200 }
    );
  }
}
