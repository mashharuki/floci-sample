import { join } from "node:path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cdk from "aws-cdk-lib/core";
import type { Construct } from "constructs";

export interface CdkStackProps extends cdk.StackProps {
  target: "floci" | "aws";
}

const primaryAwsRegion = "ap-northeast-1";
const replicaAwsRegion = "ap-northeast-3";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkStackProps) {
    super(scope, id, props);

    const isAws = props.target === "aws";
    const table = new dynamodb.Table(this, "KeySetsTable", {
      tableName: "MultiRegionKeySets",
      partitionKey: {
        name: "keySetId",
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
    const backend = new lambdaNodejs.NodejsFunction(
      this,
      "MultiRegionKeyFunction",
      {
        entry: join(__dirname, "../../backend/src/lambda.ts"),
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "handler",
        environment: {
          KEY_SETS_TABLE_NAME: table.tableName,
          KMS_PROVIDER: isAws ? "aws" : "local",
          PRIMARY_AWS_REGION: primaryAwsRegion,
          REPLICA_AWS_REGION: replicaAwsRegion,
          API_KEY_CHECK_DISABLED: isAws ? "false" : "true",
        },
        bundling: { minify: true, sourceMap: true },
        logGroup: isAws
          ? new logs.LogGroup(this, "MultiRegionKeyFunctionLogs", {
              retention: logs.RetentionDays.ONE_WEEK,
              removalPolicy: cdk.RemovalPolicy.DESTROY,
            })
          : undefined,
      },
    );
    table.grantReadWriteData(backend);

    if (isAws) {
      backend.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["kms:CreateKey"],
          resources: ["*"],
          conditions: {
            StringEquals: { "aws:RequestTag/App": "multiregion-key" },
          },
        }),
      );
      backend.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["kms:CreateAlias"],
          resources: ["*"],
          conditions: {
            StringLike: { "kms:RequestAlias": "alias/mrk-sample/*" },
          },
        }),
      );
      backend.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "kms:ReplicateKey",
            "kms:DescribeKey",
            "kms:ScheduleKeyDeletion",
            "kms:Sign",
            "kms:Verify",
          ],
          resources: [
            `arn:aws:kms:${primaryAwsRegion}:${this.account}:key/*`,
            `arn:aws:kms:${replicaAwsRegion}:${this.account}:key/*`,
          ],
          conditions: {
            "ForAnyValue:StringLike": {
              "kms:ResourceAliases": "alias/mrk-sample/*",
            },
          },
        }),
      );
    }

    const api = new apigateway.RestApi(this, "MultiRegionKeyApi", {
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
      defaultMethodOptions: { apiKeyRequired: isAws },
    });
    if (isAws) {
      const apiKey = api.addApiKey("ClientApiKey");
      const plan = api.addUsagePlan("UsagePlan", {
        throttle: { rateLimit: 10, burstLimit: 20 },
      });
      plan.addApiKey(apiKey);
      plan.addApiStage({ stage: api.deploymentStage });
      new cdk.CfnOutput(this, "ApiKeyIdOutput", { value: apiKey.keyId });
      new cdk.CfnOutput(this, "UsagePlanIdOutput", {
        value: plan.usagePlanId,
      });
    }

    const apiUrl = isAws
      ? api.url
      : `http://localhost:4566/restapis/${api.restApiId}/v1/_user_request_`;

    new cdk.CfnOutput(this, "KeySetsTableNameOutput", {
      value: table.tableName,
    });
    new cdk.CfnOutput(this, "ApiIdOutput", { value: api.restApiId });
    new cdk.CfnOutput(this, "ApiUrlOutput", { value: apiUrl });
    new cdk.CfnOutput(this, "PrimaryAwsRegionOutput", {
      value: primaryAwsRegion,
    });
    new cdk.CfnOutput(this, "ReplicaAwsRegionOutput", {
      value: replicaAwsRegion,
    });
  }
}
