import { join } from "node:path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import type { AppColor, DeploymentRegion } from "../regions";

export interface TodoAppConstructProps {
  color: AppColor;
  deploymentRegion: DeploymentRegion;
  tableName: string;
  target: "floci" | "aws";
}

/**
 * TodoアプリのCDKスタック
 */
export class TodoAppConstruct extends Construct {
  /** API リソース */
  readonly api: apigateway.RestApi;
  /** S3バケット */
  readonly bucket: s3.Bucket;
  /** API URL */
  readonly apiUrl: string;
  /** アプリ URL */
  readonly appUrl: string;

  /**
   * コンストラクター
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props: TodoAppConstructProps) {
    super(scope, id);
    const { color, deploymentRegion, tableName, target } = props;
    const isAws = target === "aws";
    const colorCap = color[0].toUpperCase() + color.slice(1);

    // Lambda 関数
    const fn = new lambdaNodejs.NodejsFunction(
      this,
      `TodoFunction${colorCap}`,
      {
        entry: join(__dirname, "../../../backend/src/lambda.ts"),
        runtime: lambda.Runtime.NODEJS_24_X,
        handler: "handler",
        environment: {
          TODO_TABLE_NAME: tableName,
          APP_COLOR: color,
          APP_REGION: deploymentRegion,
        },
        bundling: { minify: true, sourceMap: true },
        logGroup: isAws
          ? new logs.LogGroup(this, `TodoFunctionLogs${colorCap}`, {
              retention: logs.RetentionDays.ONE_WEEK,
              removalPolicy: cdk.RemovalPolicy.DESTROY,
            })
          : undefined,
      },
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
        ],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: "dynamodb",
            resource: "table",
            resourceName: tableName,
          }),
        ],
      }),
    );

    // API Gateway
    this.api = new apigateway.RestApi(this, `TodoApi${colorCap}`, {
      deployOptions: { stageName: "v1" },
      endpointTypes: [apigateway.EndpointType.REGIONAL],
    });
    this.api.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(fn),
      anyMethod: true,
    });

    // S3バケット
    this.bucket = new s3.Bucket(this, `FrontendBucket${colorCap}`, {
      encryption: isAws ? s3.BucketEncryption.S3_MANAGED : undefined,
      enforceSSL: isAws,
      objectOwnership: isAws
        ? s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
        : undefined,
      blockPublicAccess: isAws
        ? s3.BlockPublicAccess.BLOCK_ALL
        : new s3.BlockPublicAccess({
            blockPublicAcls: false,
            blockPublicPolicy: false,
            ignorePublicAcls: false,
            restrictPublicBuckets: false,
          }),
      publicReadAccess: !isAws,
      // Floci の Custom Resource Lambda はローカル S3 エンドポイントを解決できない。
      // ローカルでは destroy.sh が先にバケットを空にする。
      autoDeleteObjects: isAws,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    if (isAws) {
      // CloudFront OAC からのアクセスを許可するバケットポリシー。
      // RouterStack で distribution ARN を参照するとクロススタック循環が生じるため、
      // アカウント内の CloudFront distribution をまとめて許可する条件で付与する。
      this.bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "AllowCloudFrontOAC",
          actions: ["s3:GetObject"],
          resources: [this.bucket.arnForObjects("*")],
          principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
          conditions: {
            StringLike: {
              "aws:SourceArn": `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/*`,
            },
          },
        }),
      );
    } else {
      this.bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          actions: ["s3:GetObject"],
          resources: [this.bucket.arnForObjects("*")],
          principals: [new iam.AnyPrincipal()],
        }),
      );
    }

    this.apiUrl = isAws
      ? this.api.url
      : `http://localhost:4566/restapis/${this.api.restApiId}/v1/_user_request_`;
    this.appUrl = `http://localhost:4566/${this.bucket.bucketName}/index.html`;
  }
}
