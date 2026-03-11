import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/ui/Loading";
import { getCookieAuth } from "@/lib/auth";
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

interface JoinSessionContext {
  id: string;
  status: string;
  spaceId: string | null;
  spaceName: string | null;
  spaceVisibility: "OPEN" | "PRIVATE" | null;
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
    select: { name: true, status: true, isModeratedHidden: true },
  });

  if (!vote || vote.isModeratedHidden) {
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

export default async function JoinVotePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const joinCode = normalizeJoinCode(firstParamValue(resolvedSearchParams.code));
  const spaceInviteCode = normalizeJoinCode(firstParamValue(resolvedSearchParams.spaceInvite));
  let initialSession: JoinSessionContext | null = null;

  if (joinCode) {
    const cookieStore = await cookies();
    const auth = await getCookieAuth(cookieStore);
    const requestUserId = auth?.userId ?? null;

    const vote = await prisma.session.findUnique({
      where: { joinCode },
      select: {
        id: true,
        status: true,
        creatorId: true,
        isModeratedHidden: true,
        participants: requestUserId
          ? {
              where: { userId: requestUserId },
              select: { id: true },
              take: 1,
            }
          : false,
        space: {
          select: {
            id: true,
            name: true,
            visibility: true,
          },
        },
      },
    });

    const isOwner = !!requestUserId && vote?.creatorId === requestUserId;
    const isParticipant = Array.isArray(vote?.participants) && vote.participants.length > 0;
    if (vote?.isModeratedHidden && !isOwner && !isParticipant) {
      notFound();
    }

    if (vote) {
      initialSession = {
        id: vote.id,
        status: vote.status,
        spaceId: vote.space?.id ?? null,
        spaceName: vote.space?.name ?? null,
        spaceVisibility: vote.space?.visibility ?? null,
      };
    }

    const isClosedVote = !!vote && vote.status !== "OPEN";
    const isClosedPrivateSpaceVote = isClosedVote && vote?.space?.visibility === "PRIVATE";
    let isSpaceMember = false;
    if (isClosedPrivateSpaceVote && requestUserId && vote?.space?.id) {
      const membership = await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId: vote.space.id, userId: requestUserId } },
        select: { id: true },
      });
      isSpaceMember = !!membership;
    }
    const shouldAllowJoinSpaceThenContinue =
      isClosedPrivateSpaceVote && !!spaceInviteCode && !isSpaceMember;

    if (isClosedVote && !shouldAllowJoinSpaceThenContinue) {
      redirect(`/sessions/${vote.id}/results?code=${encodeURIComponent(joinCode)}`);
    }
  }

  return (
    <Suspense fallback={<Loading />}>
      <JoinVotePageClient initialSession={initialSession} />
    </Suspense>
  );
}
