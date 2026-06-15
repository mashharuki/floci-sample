import type * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib/core";
import type { Construct } from "constructs";

export interface TodoBgRouterStackProps extends cdk.StackProps {
  active: "blue" | "green";
  blueApi: apigateway.RestApi;
  greenApi: apigateway.RestApi;
  blueBucket: s3.Bucket;
  greenBucket: s3.Bucket;
}

/**
 * Todo Blue/Green ルータースタック
 */
export class TodoBgRouterStack extends cdk.Stack {
  /**
   * コンストラクター
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props: TodoBgRouterStackProps) {
    super(scope, id, props);

    const { active, blueApi, greenApi, blueBucket, greenBucket } = props;

    // クロススタック依存循環を避けるため、バケットをインポート参照として扱う。
    // S3BucketOrigin.withOriginAccessControl はインポートバケットに対して
    // addToResourcePolicy を no-op にするため、OAC バケットポリシーは
    // TodoAppConstruct 側でバケット作成時に付与している（クロスタック参照不要）。
    const importedBlueBucket = s3.Bucket.fromBucketAttributes(
      this,
      "ImportedBlueBucket",
      {
        bucketArn: blueBucket.bucketArn,
        bucketName: blueBucket.bucketName,
      },
    );
    const importedGreenBucket = s3.Bucket.fromBucketAttributes(
      this,
      "ImportedGreenBucket",
      {
        bucketArn: greenBucket.bucketArn,
        bucketName: greenBucket.bucketName,
      },
    );

    const blueOrigin =
      origins.S3BucketOrigin.withOriginAccessControl(importedBlueBucket);
    const greenOrigin =
      origins.S3BucketOrigin.withOriginAccessControl(importedGreenBucket);
    const activeApi = active === "blue" ? blueApi : greenApi;

    // CloudFrontでフロントとバックエンドを管理する
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: active === "blue" ? blueOrigin : greenOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.RestApiOrigin(activeApi),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    // ========================================================================
    // CDKスタック成果物
    // ========================================================================

    new cdk.CfnOutput(this, "DistributionDomainOutput", {
      value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "AppUrlOutput", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "ActiveColorOutput", { value: active });
  }
}
