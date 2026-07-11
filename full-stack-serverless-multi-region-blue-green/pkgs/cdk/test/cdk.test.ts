import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { TodoBgAppStack } from "../lib/stacks/todo-bg-app-stack";
import { TodoBgDataStack } from "../lib/stacks/todo-bg-data-stack";
import { TodoBgRouterStack } from "../lib/stacks/todo-bg-router-stack";

function createStacks(target: "floci" | "aws") {
  const app = new App();
  const env =
    target === "floci"
      ? { account: "000000000000", region: "us-east-1" }
      : { account: "123456789012", region: "ap-northeast-1" };
  const dataStack = new TodoBgDataStack(app, "TodoBgDataStack", {
    target,
    env,
  });
  const blueStack = new TodoBgAppStack(app, "TodoBgBlueStack", {
    color: "blue",
    table: dataStack.table,
    target,
    env,
  });
  const greenStack = new TodoBgAppStack(app, "TodoBgGreenStack", {
    color: "green",
    table: dataStack.table,
    target,
    env,
  });
  return { app, dataStack, blueStack, greenStack, env };
}

test("DataStack creates DynamoDB table", () => {
  const { dataStack } = createStacks("floci");
  const template = Template.fromStack(dataStack);
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: "Todos",
    BillingMode: "PAY_PER_REQUEST",
  });
});

test("BlueStack creates Lambda, APIGW, S3 for floci", () => {
  const { blueStack } = createStacks("floci");
  const template = Template.fromStack(blueStack);
  // autoDeleteObjects: true が BucketAutoDeleteObjectsProvider Lambda を追加するため 2
  template.resourceCountIs("AWS::Lambda::Function", 2);
  template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
  template.resourceCountIs("AWS::S3::Bucket", 1);
  template.resourceCountIs("AWS::CloudFront::Distribution", 0);
});

test("GreenStack creates Lambda, APIGW, S3 for floci", () => {
  const { greenStack } = createStacks("floci");
  const template = Template.fromStack(greenStack);
  // autoDeleteObjects: true が BucketAutoDeleteObjectsProvider Lambda を追加するため 2
  template.resourceCountIs("AWS::Lambda::Function", 2);
  template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
  template.resourceCountIs("AWS::S3::Bucket", 1);
});

test("AWS RouterStack creates CloudFront distribution", () => {
  const { app, blueStack, greenStack, env } = createStacks("aws");
  const routerStack = new TodoBgRouterStack(app, "TodoBgRouterStack", {
    active: "blue",
    blueApi: blueStack.api,
    greenApi: greenStack.api,
    blueBucket: blueStack.bucket,
    greenBucket: greenStack.bucket,
    env,
  });
  const template = Template.fromStack(routerStack);
  template.resourceCountIs("AWS::CloudFront::Distribution", 1);
  template.hasOutput("ActiveColorOutput", { Value: "blue" });
});

test("RouterStack with active=green outputs green", () => {
  const { app, blueStack, greenStack, env } = createStacks("aws");
  const routerStack = new TodoBgRouterStack(app, "TodoBgRouterStack", {
    active: "green",
    blueApi: blueStack.api,
    greenApi: greenStack.api,
    blueBucket: blueStack.bucket,
    greenBucket: greenStack.bucket,
    env,
  });
  const template = Template.fromStack(routerStack);
  template.hasOutput("ActiveColorOutput", { Value: "green" });
});

test("AWS BlueStack S3 bucket blocks public access", () => {
  const { blueStack } = createStacks("aws");
  const template = Template.fromStack(blueStack);
  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});

test("DataStack has CfnOutput for table name", () => {
  const { dataStack } = createStacks("floci");
  const template = Template.fromStack(dataStack);
  template.hasOutput("TodoTableNameOutput", {});
});

test("AppStack has CfnOutput for ApiUrlOutput and AppUrlOutput", () => {
  const { blueStack } = createStacks("floci");
  const template = Template.fromStack(blueStack);
  template.hasOutput("ApiUrlOutput", {});
  template.hasOutput("AppUrlOutput", {});
});
