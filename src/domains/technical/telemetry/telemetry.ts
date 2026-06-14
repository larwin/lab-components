import { valueToken } from "@/framework/services";

/**
 * Telemetry — a tiny build counter so the demo can PROVE "rebuilt once per
 * change" on screen. Cross-cutting (platform), injected into the services whose
 * rebuilds we want to observe. A real app would not carry this.
 */
export interface Telemetry {
  fieldServiceBuilds: number;
  editorServiceBuilds: number;
}

export const createTelemetry = (): Telemetry => ({
  fieldServiceBuilds: 0,
  editorServiceBuilds: 0,
});

export const TelemetryToken = valueToken<Telemetry>("Telemetry");
