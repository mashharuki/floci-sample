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

  test("creates DynamoDB, Lambda, REST API, bucket, and outputs", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "Todos",
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Environment: {
        Variables: { TODO_TABLE_NAME: Match.anyValue() },
      },
    });
    template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
    template.resourceCountIs("AWS::S3::Bucket", 1);
    for (const output of [
      "TodoTableNameOutput",
      "ApiIdOutput",
      "ApiUrlOutput",
      "FrontendBucketNameOutput",
      "AppUrlOutput",
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

test("Floci omits CloudFront and allows public S3 reads", () => {
  const template = templateFor("floci");
  template.resourceCountIs("AWS::CloudFront::Distribution", 0);
  template.hasResourceProperties("AWS::S3::BucketPolicy", {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({ Action: "s3:GetObject", Principal: { AWS: "*" } }),
      ]),
    },
  });
});

test("AWS uses private S3, OAC, CloudFront, and /api behavior", () => {
  const template = templateFor("aws");
  template.hasResourceProperties("AWS::S3::Bucket", {
    BucketEncryption: Match.anyValue(),
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
  template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: {
      CacheBehaviors: Match.arrayWith([
        Match.objectLike({ PathPattern: "/api/*" }),
      ]),
    },
  });
});
