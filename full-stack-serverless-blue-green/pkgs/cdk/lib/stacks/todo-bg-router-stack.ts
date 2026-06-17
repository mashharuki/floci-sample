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

    // OAC を事前に作成して安定させる。
    // active の切り替え時に OAC が create/delete されると Distribution 更新が
    // 不安定になるため、両色分の OAC を常に保持し Distribution だけを変更する。
    const blueOac = new cloudfront.S3OriginAccessControl(this, "BlueS3Oac", {
      description: "OAC for blue frontend S3 bucket",
    });
    const greenOac = new cloudfront.S3OriginAccessControl(this, "GreenS3Oac", {
      description: "OAC for green frontend S3 bucket",
    });

    const blueOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      importedBlueBucket,
      { originAccessControl: blueOac },
    );
    const greenOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      importedGreenBucket,
      { originAccessControl: greenOac },
    );

    const activeApi = active === "blue" ? blueApi : greenApi;
    // 非アクティブ側の API も additionalBehaviors に常に含めることで
    // 切り替え時に cross-stack export が削除されず CloudFormation エラーを防ぐ。
    const standbyApi = active === "blue" ? greenApi : blueApi;

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
        // 非アクティブ側 API を常に参照することで cross-stack export を安定させる。
        // このパスはアプリからは呼び出されない内部ルート。
        "/_bg-standby/*": {
          origin: new origins.RestApiOrigin(standbyApi),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
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
