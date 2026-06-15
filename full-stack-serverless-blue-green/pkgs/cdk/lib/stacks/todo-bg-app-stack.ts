import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { TodoAppConstruct } from "../constructs/todo-app-construct.js";

export interface TodoBgAppStackProps extends cdk.StackProps {
  color: "blue" | "green";
  table: dynamodb.ITable;
  target: "floci" | "aws";
}

export class TodoBgAppStack extends cdk.Stack {
  readonly api: apigateway.RestApi;
  readonly bucket: s3.Bucket;
  readonly apiUrl: string;
  readonly appUrl: string;

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

    new cdk.CfnOutput(this, "ApiIdOutput", { value: app.api.restApiId });
    new cdk.CfnOutput(this, "ApiUrlOutput", { value: app.apiUrl });
    new cdk.CfnOutput(this, "FrontendBucketNameOutput", { value: app.bucket.bucketName });
    new cdk.CfnOutput(this, "AppUrlOutput", { value: app.appUrl });
  }
}
