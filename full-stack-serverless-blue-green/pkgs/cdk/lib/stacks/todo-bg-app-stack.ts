import type * as apigateway from "aws-cdk-lib/aws-apigateway";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib/core";
import type { Construct } from "constructs";
import { TodoAppConstruct } from "../constructs/todo-app-construct";

export interface TodoBgAppStackProps extends cdk.StackProps {
  color: "blue" | "green";
  table: dynamodb.ITable;
  target: "floci" | "aws";
}

/**
 * Todoアプリ【Blue/Green】
 */
export class TodoBgAppStack extends cdk.Stack {
  readonly api: apigateway.RestApi;
  readonly bucket: s3.Bucket;
  readonly apiUrl: string;
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
    const app = new TodoAppConstruct(this, `TodoApp${colorCap}`, {
      color: props.color,
      table: props.table,
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
  }
}
