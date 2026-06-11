import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

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

    // ========================================================================
    // CDK成果物
    // ========================================================================

    new cdk.CfnOutput(this, 'CdkQueueOutput', {
      value: queue.queueName,
      exportName: 'FlociSampleCdkQueue', // 重要: 一意な名前
    });
  }
}
