import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib/core";
import type { Construct } from "constructs";
import type {
  AppColor,
  DeploymentRegion,
  DeploymentRegionName,
} from "../regions";

export interface TodoBgRouterStackProps extends cdk.StackProps {
  activeColor: AppColor;
  activeRegion: DeploymentRegionName;
  activeDeploymentRegion: DeploymentRegion;
  activeApiUrl: string;
  activeBucketName: string;
}

/** CloudFront から1つのリージョン・カラー組へ配信するルーター。 */
export class TodoBgRouterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TodoBgRouterStackProps) {
    super(scope, id, props);

    // バケットポリシーは各リージョンの AppStack で明示的に管理する。
    cdk.Annotations.of(this).acknowledgeWarning(
      "@aws-cdk/aws-cloudfront-origins:updateImportedBucketPolicyOac",
    );

    const apiUrl = new URL(props.activeApiUrl);
    const bucket = s3.Bucket.fromBucketName(
      this,
      "ActiveFrontendBucket",
      props.activeBucketName,
    );
    const originAccessControl = new cloudfront.S3OriginAccessControl(
      this,
      "ActiveS3Oac",
      { description: "OAC for the active regional frontend bucket" },
    );

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket, {
          originAccessControl,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.HttpOrigin(apiUrl.host, {
            originPath: apiUrl.pathname.replace(/\/$/, ""),
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
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

    new cdk.CfnOutput(this, "DistributionDomainOutput", {
      value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "AppUrlOutput", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "ActiveColorOutput", { value: props.activeColor });
    new cdk.CfnOutput(this, "ActiveRegionOutput", {
      value: props.activeDeploymentRegion,
    });
  }
}
