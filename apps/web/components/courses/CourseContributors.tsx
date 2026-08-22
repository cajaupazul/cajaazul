'use client';

import React, { useEffect, useMemo } from 'react';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import { UserHoverCard } from '@/components/ui/UserHoverCard';
import { useUserHoverCard } from '@/components/ui/UserHoverCardProvider';
import { getStorageUrl, Profile } from '@/lib/supabase';

type ContributorProfile = Partial<Profile> & {
    id: string;
    nombre: string;
};

type Contributor = {
    profile: ContributorProfile;
    contributionCount: number;
    latestContributionAt: number;
};

interface CourseContributorsProps {
    materials: any[];
}

const MAX_VISIBLE_AVATARS = 8;

function buildContributorSummary(contributors: Contributor[]) {
    if (contributors.length === 1) {
        return <><strong>{contributors[0].profile.nombre}</strong> aportó material a este curso.</>;
    }

    if (contributors.length === 2) {
        return <><strong>{contributors[0].profile.nombre}</strong> y <strong>{contributors[1].profile.nombre}</strong> aportaron material a este curso.</>;
    }

    return (
        <>
            <strong>{contributors[0].profile.nombre}</strong>, <strong>{contributors[1].profile.nombre}</strong> y{' '}
            <strong>{contributors.length - 2} más</strong> aportaron material a este curso.
        </>
    );
}

export default function CourseContributors({ materials }: CourseContributorsProps) {
    const { framesCache, fetchFrame } = useUserHoverCard();

    const contributors = useMemo<Contributor[]>(() => {
        const contributorMap = new Map<string, Contributor>();

        materials.forEach((material) => {
            const rawProfile = Array.isArray(material.profiles)
                ? material.profiles[0]
                : material.profiles;
            const userId = material.user_id || rawProfile?.id;

            if (!userId || !rawProfile) return;

            const createdAt = material.created_at
                ? new Date(material.created_at).getTime()
                : 0;
            const existing = contributorMap.get(userId);

            if (existing) {
                existing.contributionCount += 1;
                existing.latestContributionAt = Math.max(existing.latestContributionAt, createdAt);
                return;
            }

            contributorMap.set(userId, {
                profile: {
                    ...rawProfile,
                    id: userId,
                    nombre: rawProfile.nombre?.trim() || 'Estudiante',
                },
                contributionCount: 1,
                latestContributionAt: createdAt,
            });
        });

        return Array.from(contributorMap.values()).sort((a, b) => {
            if (b.contributionCount !== a.contributionCount) {
                return b.contributionCount - a.contributionCount;
            }
            return b.latestContributionAt - a.latestContributionAt;
        });
    }, [materials]);

    const frameKeys = useMemo(
        () => Array.from(new Set(
            contributors
                .slice(0, MAX_VISIBLE_AVATARS)
                .map(({ profile }) => profile.active_frame_key)
                .filter((key): key is string => Boolean(key))
        )),
        [contributors]
    );

    useEffect(() => {
        frameKeys.forEach((frameKey) => {
            void fetchFrame(frameKey);
        });
    }, [fetchFrame, frameKeys]);

    if (contributors.length === 0) return null;

    const visibleContributors = contributors.slice(0, MAX_VISIBLE_AVATARS);
    const hiddenCount = Math.max(contributors.length - visibleContributors.length, 0);
    const contributionCount = contributors.reduce(
        (total, contributor) => total + contributor.contributionCount,
        0
    );

    return (
        <section
            aria-label="Colaboradores del curso"
            className="mb-8 flex flex-col gap-3 border-y border-bb-border/70 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
            <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex shrink-0 items-center pl-1" aria-label={`${contributors.length} colaboradores`}>
                    {visibleContributors.map((contributor, index) => {
                        const { profile, contributionCount: userContributionCount } = contributor;
                        const frame = profile.active_frame_key
                            ? framesCache.get(profile.active_frame_key)
                            : null;
                        const tooltip = `${profile.nombre}: ${userContributionCount} ${userContributionCount === 1 ? 'aporte' : 'aportes'}`;

                        return (
                            <UserHoverCard key={profile.id} profile={profile}>
                                <span
                                    className="relative inline-flex rounded-full ring-2 ring-bb-dark transition-transform duration-200 hover:z-20 hover:-translate-y-0.5 focus-visible:z-20 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-blue-500"
                                    style={{
                                        marginLeft: index === 0 ? 0 : -11,
                                        zIndex: visibleContributors.length - index,
                                    }}
                                    title={tooltip}
                                    aria-label={tooltip}
                                    tabIndex={0}
                                >
                                    <AvatarWithFrame
                                        avatarUrl={profile.avatar_url}
                                        name={profile.nombre}
                                        frameUrl={frame?.image_url ? getStorageUrl(frame.image_url, 'shop-items') : null}
                                        frameScale={frame?.frame_settings?.navbar?.scale ?? 1}
                                        offsetX={frame?.frame_settings?.navbar?.x ?? 0}
                                        offsetY={frame?.frame_settings?.navbar?.y ?? 0}
                                        size={40}
                                    />
                                </span>
                            </UserHoverCard>
                        );
                    })}

                    {hiddenCount > 0 && (
                        <span
                            className="relative z-0 -ml-[11px] inline-flex h-10 w-10 items-center justify-center rounded-full bg-bb-card text-[11px] font-black text-bb-text ring-2 ring-bb-dark"
                            aria-label={`${hiddenCount} colaboradores adicionales`}
                            title={`${hiddenCount} colaboradores adicionales`}
                        >
                            +{hiddenCount}
                        </span>
                    )}
                </div>

                <div className="min-w-0">
                    <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                        Comunidad del curso
                    </p>
                    <p className="text-xs leading-relaxed text-bb-text-secondary sm:text-sm">
                        {buildContributorSummary(contributors)}
                    </p>
                </div>
            </div>

            <div className="shrink-0 pl-[54px] text-left sm:pl-0 sm:text-right">
                <p className="text-sm font-black tabular-nums text-bb-text">{contributionCount}</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-bb-text/40">
                    {contributionCount === 1 ? 'recurso compartido' : 'recursos compartidos'}
                </p>
            </div>
        </section>
    );
}
