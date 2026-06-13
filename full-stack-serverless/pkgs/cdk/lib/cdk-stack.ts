import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

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

const todoTableDefinition = JSON.parse(
  readFileSync(join(__dirname, "../config/todo-table.json"), "utf8"),
) as TodoTableDefinition;

/**
 * サンプルCDKスタック
 */
export class CdkStack extends cdk.Stack {
  /**
   * コンストラクター
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // example resource
    const queue = new sqs.Queue(this, "CdkQueue", {
      visibilityTimeout: cdk.Duration.seconds(300),
    });

    const partitionKey = todoTableDefinition.KeySchema.find(
      ({ KeyType }) => KeyType === "HASH",
    );
    if (!partitionKey) {
      throw new Error("Todo table definition requires a HASH key");
    }

    const partitionKeyAttribute = todoTableDefinition.AttributeDefinitions.find(
      ({ AttributeName }) => AttributeName === partitionKey.AttributeName,
    );
    if (!partitionKeyAttribute) {
      throw new Error("Todo table HASH key requires an attribute definition");
    }
    if (partitionKeyAttribute.AttributeType !== "S") {
      throw new Error("Todo table HASH key must be a string");
    }

    const table = new dynamodb.Table(this, "TodoTable", {
      tableName: todoTableDefinition.TableName,
      partitionKey: {
        name: partitionKey.AttributeName,
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================================================
    // CDK成果物
    // ========================================================================

    new cdk.CfnOutput(this, "CdkQueueOutput", {
      value: queue.queueName,
      exportName: "FlociSampleCdkQueue", // 重要: 一意な名前
    });

    new cdk.CfnOutput(this, "TodoTableNameOutput", {
      value: table.tableName,
      exportName: "FlociSampleTodoTable",
    });
  }
}
