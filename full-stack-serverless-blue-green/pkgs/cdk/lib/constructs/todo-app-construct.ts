import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib/core";
import { join } from "node:path";
import { Construct } from "constructs";

export interface TodoAppConstructProps {
  color: "blue" | "green";
  table: dynamodb.ITable;
  target: "floci" | "aws";
}

export class TodoAppConstruct extends Construct {
  readonly api: apigateway.RestApi;
  readonly bucket: s3.Bucket;
  readonly apiUrl: string;
  readonly appUrl: string;

  constructor(scope: Construct, id: string, props: TodoAppConstructProps) {
    super(scope, id);
    const { color, table, target } = props;
    const isAws = target === "aws";
    const colorCap = color[0].toUpperCase() + color.slice(1);

    const fn = new lambdaNodejs.NodejsFunction(this, `TodoFunction${colorCap}`, {
      entry: join(__dirname, "../../../backend/src/lambda.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler",
      environment: { TODO_TABLE_NAME: table.tableName },
      bundling: { minify: true, sourceMap: true },
      logGroup: isAws
        ? new logs.LogGroup(this, `TodoFunctionLogs${colorCap}`, {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        : undefined,
    });
    table.grantReadWriteData(fn);

    this.api = new apigateway.RestApi(this, `TodoApi${colorCap}`, {
      deployOptions: { stageName: "v1" },
      endpointTypes: [apigateway.EndpointType.REGIONAL],
    });
    this.api.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(fn),
      anyMethod: true,
    });

    this.bucket = new s3.Bucket(this, `FrontendBucket${colorCap}`, {
      encryption: isAws ? s3.BucketEncryption.S3_MANAGED : undefined,
      enforceSSL: isAws,
      objectOwnership: isAws ? s3.ObjectOwnership.BUCKET_OWNER_ENFORCED : undefined,
      blockPublicAccess: isAws
        ? s3.BlockPublicAccess.BLOCK_ALL
        : new s3.BlockPublicAccess({
            blockPublicAcls: false,
            blockPublicPolicy: false,
            ignorePublicAcls: false,
            restrictPublicBuckets: false,
          }),
      publicReadAccess: !isAws,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    if (!isAws) {
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
