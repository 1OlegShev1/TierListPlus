import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Loading } from "@/components/ui/Loading";
import { prisma } from "@/lib/prisma";
import { JoinVotePageClient } from "./JoinVotePageClient";

type SearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_TITLE = "Join a Vote | TierList+";
const DEFAULT_DESCRIPTION = "Join a collaborative tier list vote.";

function firstParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }
  return typeof value === "string" ? value : null;
}

function normalizeJoinCode(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function buildJoinMetadata(
  title: string,
  description: string,
  ogImageUrl: string,
  imageAlt: string,
): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

function normalizeOrigin(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function resolveMetadataOrigin(): Promise<string> {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (envOrigin) {
    return normalizeOrigin(envOrigin);
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (host) {
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}): Promise<Metadata> {
  const resolvedSearchParams = (await searchParams) ?? {};
  const joinCode = normalizeJoinCode(firstParamValue(resolvedSearchParams.code));
  const origin = await resolveMetadataOrigin();
  if (!joinCode) {
    const ogImageUrl = new URL("/api/og/vote", origin).toString();
    return buildJoinMetadata(DEFAULT_TITLE, DEFAULT_DESCRIPTION, ogImageUrl, "TierList+");
  }

  const vote = await prisma.session.findUnique({
    where: { joinCode },
    select: { name: true, status: true },
  });

  if (!vote) {
    const title = "Join this vote | TierList+";
    const description = "Open invite link for a collaborative tier list vote.";
    const ogImageUrl = new URL("/api/og/vote", origin).toString();
    return buildJoinMetadata(title, description, ogImageUrl, "TierList+ vote invite");
  }

  const statusLabel = vote.status === "OPEN" ? "Now Open" : "View Results";
  const title = `Join "${vote.name}" | TierList+`;
  const description = `${statusLabel} on TierList+.`;
  const ogImageUrl = new URL(
    `/api/og/vote?title=${encodeURIComponent(vote.name)}&status=${encodeURIComponent(statusLabel)}`,
    origin,
  ).toString();
  return buildJoinMetadata(title, description, ogImageUrl, `${vote.name} invite card`);
}

export default function JoinVotePage() {
  return (
    <Suspense fallback={<Loading />}>
      <JoinVotePageClient />
    </Suspense>
  );
}
