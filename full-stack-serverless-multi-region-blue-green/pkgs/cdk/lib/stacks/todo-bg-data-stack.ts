import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cdk from "aws-cdk-lib/core";
import type { Construct } from "constructs";
import type { DeploymentRegion } from "../regions";

interface TodoTableDefinition {
  TableName: string;
  AttributeDefinitions: Array<{ AttributeName: string; AttributeType: "S" }>;
  KeySchema: Array<{ AttributeName: string; KeyType: "HASH" }>;
}

const definition = JSON.parse(
  readFileSync(join(__dirname, "../../config/todo-table.json"), "utf8"),
) as TodoTableDefinition;

export interface TodoBgDataStackProps extends cdk.StackProps {
  target: "floci" | "aws";
  replicaRegions?: DeploymentRegion[];
}

/** DynamoDB を管理する共有データスタック。 */
export class TodoBgDataStack extends cdk.Stack {
  readonly tableName = definition.TableName;

  constructor(scope: Construct, id: string, props: TodoBgDataStackProps) {
    super(scope, id, props);

    if (props.target === "aws") {
      new dynamodb.CfnGlobalTable(this, "TodoGlobalTable", {
        tableName: this.tableName,
        attributeDefinitions: definition.AttributeDefinitions.map(
          ({ AttributeName, AttributeType }) => ({
            attributeName: AttributeName,
            attributeType: AttributeType,
          }),
        ),
        keySchema: definition.KeySchema.map(({ AttributeName, KeyType }) => ({
          attributeName: AttributeName,
          keyType: KeyType,
        })),
        billingMode: "PAY_PER_REQUEST",
        streamSpecification: {
          streamViewType: "NEW_AND_OLD_IMAGES",
        },
        replicas: (props.replicaRegions ?? []).map((region) => ({
          region,
        })),
      }).applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    } else {
      new dynamodb.Table(this, "TodoTable", {
        tableName: this.tableName,
        partitionKey: {
          name: definition.KeySchema[0]?.AttributeName ?? "id",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    }

    new cdk.CfnOutput(this, "TodoTableNameOutput", { value: this.tableName });
  }
}
