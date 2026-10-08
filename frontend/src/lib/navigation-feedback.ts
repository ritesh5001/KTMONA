const NAVIGATION_START_EVENT = "ktmona:navigation-start";
const API_ACTIVITY_EVENT = "ktmona:api-activity";

export type ApiActivityDetail = {
  type: "start" | "end";
  method?: string;
  path?: string;
  label?: string;
};

export function startNavigationFeedback() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT));
}

export function reportApiActivity(detail: ApiActivityDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ApiActivityDetail>(API_ACTIVITY_EVENT, { detail }));
}

export { API_ACTIVITY_EVENT, NAVIGATION_START_EVENT };
