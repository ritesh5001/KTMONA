"use client";

import { useEffect, useState } from "react";
import {
  decodeJwtPayload,
  getAccessToken,
  getSessionRole,
  getSessionUser,
  hasSession,
} from "@/lib/session";

interface User {
    id: string;
    role: string;
    [key: string]: any;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [signedIn, setSignedIn] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const syncAuth = () => {
            // `hasSession` is the single authority on "is this a session" — an
            // expired access token with a live refresh token still counts,
            // because the API layer renews it silently. Deriving this from the
            // access cookie alone used to make the header claim the buyer was
            // signed out while the rest of the app knew they were signed in.
            const authed = hasSession();
            setSignedIn(authed);
            setToken(getAccessToken());

            if (!authed) {
                setUser(null);
                setLoading(false);
                return;
            }

            const storedUser = getSessionUser<User>();
            if (storedUser) {
                setUser(storedUser);
                setLoading(false);
                return;
            }

            const accessToken = getAccessToken();
            const decoded = accessToken ? decodeJwtPayload<User>(accessToken) : null;
            const role = getSessionRole();

            if (decoded) {
                setUser(decoded);
            } else if (role) {
                setUser({ id: "", role } as User);
            } else {
                setUser(null);
            }

            setLoading(false);
        };

        syncAuth();

        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                syncAuth();
            }
        };

        window.addEventListener("ktmona-auth", syncAuth);
        window.addEventListener("focus", syncAuth);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            window.removeEventListener("ktmona-auth", syncAuth);
            window.removeEventListener("focus", syncAuth);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    return { user, token, loading, isSignedIn: signedIn };
}
