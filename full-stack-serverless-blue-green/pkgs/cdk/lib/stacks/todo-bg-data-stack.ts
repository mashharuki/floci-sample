import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface TodoTableDefinition {
  TableName: string;
  AttributeDefinitions: Array<{ AttributeName: string; AttributeType: "S" }>;
  KeySchema: Array<{ AttributeName: string; KeyType: "HASH" }>;
  BillingMode: "PAY_PER_REQUEST";
}

const definition = JSON.parse(
  readFileSync(join(__dirname, "../../config/todo-table.json"), "utf8"),
) as TodoTableDefinition;

export interface TodoBgDataStackProps extends cdk.StackProps {
  target: "floci" | "aws";
}

export class TodoBgDataStack extends cdk.Stack {
  readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: TodoBgDataStackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, "TodoTable", {
      tableName: definition.TableName,
      partitionKey: {
        name: definition.KeySchema[0]?.AttributeName ?? "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, "TodoTableNameOutput", { value: this.table.tableName });
  }
}
