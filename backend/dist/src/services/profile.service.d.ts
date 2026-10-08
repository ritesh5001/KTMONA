export interface ProfileResponse {
    profile: {
        userId: string;
        fullName: string | null;
        email: string | null;
        phone: string | null;
        avatar: string | null;
    };
}
export declare class ProfileService {
    getProfile(userId: string): Promise<ProfileResponse>;
    /**
     * Set or clear the avatar.
     *
     * `null` is a deliberate, distinct outcome from "not provided": it removes
     * the picture and returns the user to their initial, which is the only way
     * to undo an upload they regret.
     */
    updateAvatar(userId: string, avatar: string | null): Promise<ProfileResponse>;
}
export declare const profileService: ProfileService;
//# sourceMappingURL=profile.service.d.ts.map