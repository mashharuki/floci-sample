import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { CdkStack } from "../lib/cdk-stack";

function templateFor(target: "floci" | "aws") {
  const app = new App();
  return Template.fromStack(
    new CdkStack(app, `Test-${target}`, {
      target,
      env: {
        account: target === "floci" ? "000000000000" : "123456789012",
        region: target === "floci" ? "us-east-1" : "ap-northeast-1",
      },
    }),
  );
}

describe.each(["floci", "aws"] as const)("CdkStack target=%s", (target) => {
  const template = templateFor(target);

  test("creates DynamoDB, Lambda, REST API, and outputs", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "MultiRegionKeySets",
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [{ AttributeName: "keySetId", KeyType: "HASH" }],
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Environment: {
        Variables: {
          KEY_SETS_TABLE_NAME: Match.anyValue(),
          KMS_PROVIDER: target === "aws" ? "aws" : "local",
          PRIMARY_AWS_REGION: "ap-northeast-1",
          REPLICA_AWS_REGION: "ap-northeast-3",
        },
      },
    });
    template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
    template.resourceCountIs("AWS::S3::Bucket", 0);
    for (const output of [
      "KeySetsTableNameOutput",
      "ApiIdOutput",
      "ApiUrlOutput",
      "PrimaryAwsRegionOutput",
      "ReplicaAwsRegionOutput",
    ]) {
      template.hasOutput(output, {});
    }
  });

  test("grants only table data actions to the Lambda role", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:DeleteItem",
            ]),
            Effect: "Allow",
          }),
        ]),
      },
    });
  });
});

test("Floci omits AWS-only API key and KMS IAM resources", () => {
  const template = templateFor("floci");
  template.resourceCountIs("AWS::CloudFront::Distribution", 0);
  template.resourceCountIs("AWS::ApiGateway::ApiKey", 0);
  template.hasResourceProperties("AWS::Lambda::Function", {
    Environment: {
      Variables: Match.objectLike({
        API_KEY_CHECK_DISABLED: "true",
        KMS_PROVIDER: "local",
      }),
    },
  });
});

test("AWS requires API keys and grants scoped KMS actions", () => {
  const template = templateFor("aws");
  template.resourceCountIs("AWS::ApiGateway::ApiKey", 1);
  template.resourceCountIs("AWS::ApiGateway::UsagePlan", 1);
  template.hasResourceProperties("AWS::ApiGateway::Method", {
    ApiKeyRequired: true,
  });
  template.hasResourceProperties("AWS::Lambda::Function", {
    Environment: {
      Variables: Match.objectLike({
        API_KEY_CHECK_DISABLED: "false",
        KMS_PROVIDER: "aws",
      }),
    },
  });
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith(["kms:CreateKey", "kms:TagResource"]),
          Condition: {
            StringEquals: Match.objectLike({
              "aws:RequestTag/App": "multiregion-key",
            }),
            "ForAllValues:StringEquals": {
              "aws:TagKeys": ["App", "KeySetId"],
            },
            Null: {
              "aws:TagKeys": "false",
            },
          },
        }),
        Match.objectLike({
          Action: "kms:CreateAlias",
          Resource: Match.arrayWith([
            "arn:aws:kms:ap-northeast-1:123456789012:alias/mrk-sample/*",
            "arn:aws:kms:ap-northeast-3:123456789012:alias/mrk-sample/*",
            "arn:aws:kms:ap-northeast-1:123456789012:key/*",
            "arn:aws:kms:ap-northeast-3:123456789012:key/*",
          ]),
        }),
        Match.objectLike({
          Action: "kms:ReplicateKey",
          Resource: "arn:aws:kms:ap-northeast-1:123456789012:key/*",
          Condition: {
            StringEquals: Match.objectLike({
              "aws:ResourceTag/App": "multiregion-key",
              "kms:ReplicaRegion": "ap-northeast-3",
            }),
          },
        }),
        Match.objectLike({
          Action: Match.arrayWith(["kms:Sign", "kms:Verify"]),
          Resource: Match.arrayWith([
            "arn:aws:kms:ap-northeast-1:123456789012:key/*",
            "arn:aws:kms:ap-northeast-3:123456789012:key/*",
          ]),
          Condition: {
            StringEquals: Match.objectLike({
              "aws:ResourceTag/App": "multiregion-key",
            }),
          },
        }),
        Match.objectLike({
          Action: "iam:CreateServiceLinkedRole",
          Condition: {
            StringLike: {
              "iam:AWSServiceName": [
                "kms.amazonaws.com",
                "*.kms.amazonaws.com",
              ],
            },
          },
        }),
      ]),
    },
  });
});
