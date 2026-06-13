import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { CdkStack } from "../lib/cdk-stack";

describe("CdkStack", () => {
  const app = new App();
  const stack = new CdkStack(app, "TestStack");
  const template = Template.fromStack(stack);

  test("SQS queue is created", () => {
    template.hasResourceProperties("AWS::SQS::Queue", {
      VisibilityTimeout: 300,
    });
  });

  test("Todo DynamoDB table is created from the JSON definition", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "Todos",
      AttributeDefinitions: [
        {
          AttributeName: "id",
          AttributeType: "S",
        },
      ],
      KeySchema: [
        {
          AttributeName: "id",
          KeyType: "HASH",
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  test("Todo table name is exported", () => {
    template.hasOutput("TodoTableNameOutput", {
      Export: {
        Name: "FlociSampleTodoTable",
      },
    });
  });
});
