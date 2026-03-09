import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UserStats {
    wins: bigint;
    losses: bigint;
    draws: bigint;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    adminRecordMatch(winner: Principal, loser: Principal, rounds: bigint): Promise<void>;
    adminResetStats(player: Principal): Promise<void>;
    adminSetStats(player: Principal, stats: UserStats): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getLeaderboard(): Promise<Array<[Principal, UserStats]>>;
    getMyStats(): Promise<UserStats>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    recordDraw(opponent: Principal): Promise<void>;
    recordMatch(loser: Principal, rounds: bigint): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
}
