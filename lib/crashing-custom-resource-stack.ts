import * as cdk from 'aws-cdk-lib/core';
import { CustomResource } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * A stack whose custom resource handler is denied a management-plane call and then CRASHES
 * without logging the cause and without sending any response to CloudFormation.
 *
 * This is the worst-case "error is presented nowhere" scenario:
 *   - CloudWatch Logs show nothing useful (only the entry line; the cause is never logged).
 *   - CloudFormation never receives a cfn-response, so it waits for the custom-resource
 *     timeout before failing (default ~1 hour; shortened here via `serviceTimeout`).
 *   - The ONLY place the real AccessDenied on s3:CreateBucket exists is CloudTrail.
 */
export class CrashingCustomResourceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new lambda.Function(this, 'CrHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      loggingFormat: lambda.LoggingFormat.JSON,
      // Short timeout so the function dies fast on each invocation.
      timeout: cdk.Duration.seconds(10),
      // No retries, so we don't get 3 rounds of the crash dragging things out.
      retryAttempts: 0,
      code: lambda.Code.fromInline([
        "const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');",
        "",
        "exports.handler = async (event, context) => {",
        "  console.log('request type:', JSON.stringify(event.RequestType));",
        "  if (event.RequestType === 'Create') {",
        "    try {",
        "      const s3 = new S3Client({});",
        "      await s3.send(new CreateBucketCommand({ Bucket: 'crash-setup-' + context.awsRequestId }));",
        "    } catch (err) {",
        "      // Crash WITHOUT logging the cause and WITHOUT responding to CloudFormation.",
        "      // The AccessDenied never reaches the logs or the cfn-response callback.",
        "      process.exit(1);",
        "    }",
        "  }",
        "  // (Create path never reaches here; other request types simply never respond either.)",
        "};",
      ].join('\n')),
    });

    new CustomResource(this, 'MyCrashingResource', {
      serviceToken: fn.functionArn,
      // Fail after 60s instead of CloudFormation's ~1 hour default when the handler never
      // responds — the whole point of this fixture is a handler that crashes silently.
      serviceTimeout: cdk.Duration.seconds(60),
    });
  }
}
