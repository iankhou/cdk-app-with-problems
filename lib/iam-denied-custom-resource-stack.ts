import * as cdk from 'aws-cdk-lib/core';
import { CustomResource } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * A stack whose custom resource fails because its execution role is missing an IAM
 * permission it needs at runtime — the failure is in the control plane, not the code.
 *
 * This is a fixture for CloudTrail-based deploy diagnosis. The handler makes a single
 * AWS API call (`s3:CreateBucket`) that the default Lambda execution role is NOT granted.
 * On Create the call returns AccessDenied, and the handler reports FAILED with a
 * deliberately vague reason ("internal error during setup") that names neither the API
 * nor the missing permission. So:
 *
 *   - CloudWatch Logs show only the generic message — not enough to diagnose.
 *   - CloudTrail records `AccessDenied` on `s3:CreateBucket` by this function's
 *     execution role, at the exact time of failure — the actionable signal.
 *
 * Note: this uses a *control-plane* call (CreateBucket) on purpose. CloudTrail's
 * LookupEvents returns management (control-plane) events — roughly, low-traffic
 * configuration APIs — not data-plane events. The distinction is not read vs. write:
 * S3 PutObject is mutating but data-plane (not recorded), while Lambda
 * GetFunctionConfiguration is a read but control-plane (recorded). A denied data-plane
 * call would not appear in LookupEvents at all.
 *
 * On Update/Delete it succeeds, so a rollback's Delete completes cleanly and the stack
 * is not left wedged.
 */
export class IamDeniedCustomResourceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new lambda.Function(this, 'CrHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      loggingFormat: lambda.LoggingFormat.JSON,
      // The SDK call retries with backoff before surfacing AccessDenied, which exceeds the
      // default 3s timeout. Give it room to reach the catch block and report the vague FAILED
      // (otherwise the function times out and we test a timeout, not a reported permission error).
      timeout: cdk.Duration.seconds(30),
      // Intentionally NOT granting s3:CreateBucket — the role only has the default
      // AWSLambdaBasicExecutionRole (logs) permissions. The handler's S3 call is denied.
      code: lambda.Code.fromInline([
        "const https = require('https');",
        "const url = require('url');",
        "const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');",
        "",
        "// Await-able response to CloudFormation. Unlike the callback-based cfn-response module,",
        "// this resolves only after the PUT completes, so the async handler can't freeze before",
        "// the response is delivered (which would hang the stack until CloudFormation times out).",
        "function respond(event, context, status, data) {",
        "  const body = JSON.stringify({",
        "    Status: status,",
        "    Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,",
        "    PhysicalResourceId: context.logStreamName,",
        "    StackId: event.StackId,",
        "    RequestId: event.RequestId,",
        "    LogicalResourceId: event.LogicalResourceId,",
        "    Data: data || {},",
        "  });",
        "  const parsed = url.parse(event.ResponseURL);",
        "  return new Promise((resolve, reject) => {",
        "    const req = https.request({",
        "      hostname: parsed.hostname, port: 443, path: parsed.path,",
        "      method: 'PUT', headers: { 'content-type': '', 'content-length': body.length },",
        "    }, (res) => { res.on('data', () => {}); res.on('end', resolve); });",
        "    req.on('error', reject);",
        "    req.write(body);",
        "    req.end();",
        "  });",
        "}",
        "",
        "exports.handler = async (event, context) => {",
        "  console.log('request type:', JSON.stringify(event.RequestType));",
        "  if (event.RequestType === 'Create') {",
        "    try {",
        "      // A mutating call the default execution role can't make. CloudTrail records the",
        "      // resulting AccessDenied (it logs write API calls), unlike a read such as GetParameter.",
        "      const s3 = new S3Client({});",
        "      await s3.send(new CreateBucketCommand({ Bucket: 'iam-denied-setup-' + context.awsRequestId }));",
        "      await respond(event, context, 'SUCCESS', {});",
        "    } catch (err) {",
        "      // Log the actual S3 error to see what CreateBucket returns when denied.",
        "      console.error('Setup failed:', err.name, '-', err.message);",
        "      console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));",
        "      await respond(event, context, 'FAILED', { error: 'internal error during setup' });",
        "    }",
        "    return;",
        "  }",
        "  await respond(event, context, 'SUCCESS', {});",
        "};",
      ].join('\n')),
    });

    new CustomResource(this, 'MyDeniedResource', { serviceToken: fn.functionArn });
  }
}
