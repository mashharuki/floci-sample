import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { TodoBgAppStack } from "../lib/stacks/todo-bg-app-stack";
import { TodoBgDataStack } from "../lib/stacks/todo-bg-data-stack";
import { TodoBgRouterStack } from "../lib/stacks/todo-bg-router-stack";

const account = "123456789012";

function createDataStack(
  target: "floci" | "aws",
  replicaRegions: Array<"ap-northeast-1" | "ap-northeast-3"> = [
    "ap-northeast-1",
    "ap-northeast-3",
  ],
) {
  const app = new App();
  const env = {
    account: target === "floci" ? "000000000000" : account,
    region: target === "floci" ? "us-east-1" : "ap-northeast-1",
  };
  const dataStack = new TodoBgDataStack(app, "TodoBgDataStack", {
    target,
    env,
    replicaRegions: target === "aws" ? [...replicaRegions] : undefined,
  });
  return { app, dataStack, env };
}

function createAppStack(
  target: "floci" | "aws",
  deploymentRegion: "ap-northeast-1" | "ap-northeast-3",
  color: "blue" | "green",
) {
  const { app, dataStack } = createDataStack(target);
  const appStack = new TodoBgAppStack(
    app,
    `TodoBg${deploymentRegion}${color}Stack`,
    {
      color,
      deploymentRegion,
      tableName: dataStack.tableName,
      target,
      env: {
        account: target === "floci" ? "000000000000" : account,
        region: target === "floci" ? "us-east-1" : deploymentRegion,
      },
    },
  );
  return { app, appStack };
}

test("AWS data stack creates a global table with the Osaka replica", () => {
  const { dataStack } = createDataStack("aws");
  const template = Template.fromStack(dataStack);
  template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
    TableName: "Todos",
    BillingMode: "PAY_PER_REQUEST",
    StreamSpecification: { StreamViewType: "NEW_AND_OLD_IMAGES" },
    Replicas: [{ Region: "ap-northeast-1" }, { Region: "ap-northeast-3" }],
  });
});

test("Floci data stack creates a regular DynamoDB table", () => {
  const { dataStack } = createDataStack("floci");
  Template.fromStack(dataStack).hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: "Todos",
    BillingMode: "PAY_PER_REQUEST",
  });
});

test("AWS data stack supports a primary-only global table creation phase", () => {
  const { dataStack } = createDataStack("aws", ["ap-northeast-1"]);
  Template.fromStack(dataStack).hasResourceProperties(
    "AWS::DynamoDB::GlobalTable",
    { Replicas: [{ Region: "ap-northeast-1" }] },
  );
});

test("Floci app stack does not create the S3 auto-delete custom resource", () => {
  const { appStack } = createAppStack("floci", "ap-northeast-1", "blue");
  Template.fromStack(appStack).resourceCountIs(
    "Custom::S3AutoDeleteObjects",
    0,
  );
});

test.each([
  ["ap-northeast-1", "blue"],
  ["ap-northeast-1", "green"],
  ["ap-northeast-3", "blue"],
  ["ap-northeast-3", "green"],
] as const)(
  "%s %s app stack includes Lambda, API Gateway, and S3",
  (region, color) => {
    const { appStack } = createAppStack("aws", region, color);
    const template = Template.fromStack(appStack);
    template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
    template.resourceCountIs("AWS::S3::Bucket", 1);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          APP_COLOR: color,
          APP_REGION: region,
          TODO_TABLE_NAME: "Todos",
        },
      },
    });
  },
);

test("local Tokyo and Osaka stacks use distinct Lambda IAM policy logical IDs", () => {
  const { appStack: tokyoStack } = createAppStack(
    "floci",
    "ap-northeast-1",
    "blue",
  );
  const { appStack: osakaStack } = createAppStack(
    "floci",
    "ap-northeast-3",
    "blue",
  );
  const tokyoPolicies = Object.keys(
    Template.fromStack(tokyoStack).findResources("AWS::IAM::Policy"),
  );
  const osakaPolicies = Object.keys(
    Template.fromStack(osakaStack).findResources("AWS::IAM::Policy"),
  );

  expect(tokyoPolicies).toHaveLength(1);
  expect(osakaPolicies).toHaveLength(1);
  expect(tokyoPolicies[0]).not.toBe(osakaPolicies[0]);
});

test("router selects the requested regional API and frontend bucket", () => {
  const app = new App();
  const routerStack = new TodoBgRouterStack(app, "TodoBgRouterStack", {
    activeColor: "green",
    activeRegion: "osaka",
    activeDeploymentRegion: "ap-northeast-3",
    activeApiUrl:
      "https://example.execute-api.ap-northeast-3.amazonaws.com/v1/",
    activeBucketName: "todo-osaka-green",
    env: { account, region: "ap-northeast-1" },
  });
  const template = Template.fromStack(routerStack);
  template.resourceCountIs("AWS::CloudFront::Distribution", 1);
  expect(JSON.stringify(template.toJSON())).toContain(
    "todo-osaka-green.s3.ap-northeast-3.",
  );
  template.hasOutput("ActiveColorOutput", { Value: "green" });
  template.hasOutput("ActiveRegionOutput", { Value: "ap-northeast-3" });
  template.hasOutput("DistributionIdOutput", {});
});

test("AWS app stack directs users to the RouterStack URL", () => {
  const { appStack } = createAppStack("aws", "ap-northeast-1", "blue");
  Template.fromStack(appStack).hasOutput("AppUrlOutput", {
    Value: "Use TodoBgRouterStack.AppUrlOutput",
  });
});
