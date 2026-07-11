export const deploymentRegions = {
  tokyo: "ap-northeast-1",
  osaka: "ap-northeast-3",
} as const;

export type DeploymentRegionName = keyof typeof deploymentRegions;
export type DeploymentRegion = (typeof deploymentRegions)[DeploymentRegionName];
export type AppColor = "blue" | "green";

export function isDeploymentRegionName(
  value: unknown,
): value is DeploymentRegionName {
  return value === "tokyo" || value === "osaka";
}
