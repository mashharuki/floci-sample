import type * as apigateway from "aws-cdk-lib/aws-apigateway";
import type * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib/core";
import type { Construct } from "constructs";
import { TodoAppConstruct } from "../constructs/todo-app-construct";
import type { AppColor, DeploymentRegion } from "../regions";

export interface TodoBgAppStackProps extends cdk.StackProps {
  color: AppColor;
  deploymentRegion: DeploymentRegion;
  tableName: string;
  target: "floci" | "aws";
}

/**
 * Todoアプリ【Blue/Green】
 */
export class TodoBgAppStack extends cdk.Stack {
  /** API Gatewayによって作成されるREST APIリソース */
  readonly api: apigateway.RestApi;
  /** S3バケット */
  readonly bucket: s3.Bucket;
  /** APIのエンドポイントURL */
  readonly apiUrl: string;
  /** アプリケーションURL */
  readonly appUrl: string;

  /**
   * コンストラクター
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props: TodoBgAppStackProps) {
    super(scope, id, props);

    const colorCap = props.color[0].toUpperCase() + props.color.slice(1);
    const regionName =
      props.deploymentRegion === "ap-northeast-1" ? "Tokyo" : "Osaka";

    // Appを作成
    const app = new TodoAppConstruct(this, `TodoApp${regionName}${colorCap}`, {
      color: props.color,
      deploymentRegion: props.deploymentRegion,
      tableName: props.tableName,
      target: props.target,
    });

    this.api = app.api;
    this.bucket = app.bucket;
    this.apiUrl = app.apiUrl;
    this.appUrl = app.appUrl;

    // ========================================================================
    // CDKスタック成果物
    // ========================================================================

    new cdk.CfnOutput(this, "ApiIdOutput", { value: app.api.restApiId });
    new cdk.CfnOutput(this, "ApiUrlOutput", { value: app.apiUrl });
    new cdk.CfnOutput(this, "FrontendBucketNameOutput", {
      value: app.bucket.bucketName,
    });
    new cdk.CfnOutput(this, "AppUrlOutput", { value: app.appUrl });
    new cdk.CfnOutput(this, "DeploymentRegionOutput", {
      value: props.deploymentRegion,
    });
    new cdk.CfnOutput(this, "ColorOutput", { value: props.color });
  }
}
