import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib/core";
import type { Construct } from "constructs";

interface TodoTableDefinition {
  TableName: string;
  AttributeDefinitions: Array<{
    AttributeName: string;
    AttributeType: "S";
  }>;
  KeySchema: Array<{
    AttributeName: string;
    KeyType: "HASH";
  }>;
  BillingMode: "PAY_PER_REQUEST";
}

export interface CdkStackProps extends cdk.StackProps {
  target: "floci" | "aws";
}

const definition = JSON.parse(
  readFileSync(join(__dirname, "../config/todo-table.json"), "utf8"),
) as TodoTableDefinition;

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkStackProps) {
    super(scope, id, props);

    const isAws = props.target === "aws";
    const table = new dynamodb.Table(this, "TodoTable", {
      tableName: definition.TableName,
      partitionKey: {
        name: definition.KeySchema[0]?.AttributeName ?? "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const apiLogs = isAws
      ? new logs.LogGroup(this, "ApiAccessLogs", {
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        })
      : undefined;
    const backend = new lambdaNodejs.NodejsFunction(this, "TodoFunction", {
      entry: join(__dirname, "../../backend/src/lambda.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler",
      environment: { TODO_TABLE_NAME: table.tableName },
      bundling: { minify: true, sourceMap: true },
      logGroup: isAws
        ? new logs.LogGroup(this, "TodoFunctionLogs", {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        : undefined,
    });
    table.grantReadWriteData(backend);

    const api = new apigateway.RestApi(this, "TodoApi", {
      deployOptions: {
        stageName: "v1",
        ...(apiLogs
          ? {
              accessLogDestination: new apigateway.LogGroupLogDestination(
                apiLogs,
              ),
              accessLogFormat:
                apigateway.AccessLogFormat.jsonWithStandardFields(),
            }
          : {}),
      },
      endpointTypes: [apigateway.EndpointType.REGIONAL],
    });
    api.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(backend),
      anyMethod: true,
    });

    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
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
      autoDeleteObjects: isAws,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    let appUrl = `http://localhost:4566/${frontendBucket.bucketName}/index.html`;
    if (isAws) {
      const distribution = new cloudfront.Distribution(this, "Distribution", {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin:
            origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
        },
        additionalBehaviors: {
          "/api/*": {
            origin: new origins.RestApiOrigin(api),
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
              cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            compress: true,
          },
        },
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
      });
      appUrl = `https://${distribution.distributionDomainName}`;
    } else {
      frontendBucket.addToResourcePolicy(
        new iam.PolicyStatement({
          actions: ["s3:GetObject"],
          resources: [frontendBucket.arnForObjects("*")],
          principals: [new iam.AnyPrincipal()],
        }),
      );
    }

    const apiUrl = isAws
      ? api.url
      : `http://localhost:4566/restapis/${api.restApiId}/v1/_user_request_`;

    new cdk.CfnOutput(this, "TodoTableNameOutput", {
      value: table.tableName,
    });
    new cdk.CfnOutput(this, "ApiIdOutput", { value: api.restApiId });
    new cdk.CfnOutput(this, "ApiUrlOutput", { value: apiUrl });
    new cdk.CfnOutput(this, "FrontendBucketNameOutput", {
      value: frontendBucket.bucketName,
    });
    new cdk.CfnOutput(this, "AppUrlOutput", { value: appUrl });
  }
}
