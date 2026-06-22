import * as cdk from 'aws-cdk-lib/core';
import { CustomResource } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * A custom resource that fails WITHOUT using the cfn-response library.
 *
 * The handler writes its own response straight to the pre-signed `event.ResponseURL`
 * (the same S3 PUT protocol cfn-response implements), reporting FAILED on Create. Crucially
 * its `Reason` is a plain message that does NOT contain the "See the details in CloudWatch
 * Log Stream: <name>" pointer that cfn-response emits.
 *
 * That exercises the diagnostics' fallback path: with no stream name to extract from the
 * status reason, log surfacing must fall back to a time-windowed scan of the function's log
 * group around the failure event, rather than targeting a specific stream.
 *
 * On Update/Delete it succeeds, so a rollback's Delete completes cleanly and the stack is
 * not left wedged.
 */
export class FailingCustomResourceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new lambda.Function(this, 'CrHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline([
        "const https = require('https');",
        "const url = require('url');",
        "",
        "function respond(event, context, status, reason, data) {",
        "  const body = JSON.stringify({",
        "    Status: status,",
        "    Reason: reason,",
        "    PhysicalResourceId: context.logStreamName,",
        "    StackId: event.StackId,",
        "    RequestId: event.RequestId,",
        "    LogicalResourceId: event.LogicalResourceId,",
        "    Data: data || {},",
        "  });",
        "  const parsed = url.parse(event.ResponseURL);",
        "  return new Promise((resolve, reject) => {",
        "    const req = https.request({",
        "      hostname: parsed.hostname,",
        "      port: 443,",
        "      path: parsed.path,",
        "      method: 'PUT',",
        "      headers: { 'content-type': '', 'content-length': body.length },",
        "    }, () => resolve());",
        "    req.on('error', reject);",
        "    req.write(body);",
        "    req.end();",
        "  });",
        "}",
        "",
        "exports.handler = async (event, context) => {",
        "  console.log('request type:', JSON.stringify(event.RequestType));",
        "  if (event.RequestType === 'Create') {",
        "    console.error('Boom: simulated custom resource failure on Create (no cfn-response)');",
        "    // Reason deliberately omits any 'CloudWatch Log Stream:' pointer.",
        "    await respond(event, context, 'FAILED', 'Custom resource failed: simulated error', { error: 'simulated-no-cfn-response' });",
        "    return;",
        "  }",
        "  await respond(event, context, 'SUCCESS', 'OK', {});",
        "};",
      ].join('\n')),
    });

    new CustomResource(this, 'MyFailingResource', { serviceToken: fn.functionArn });
  }
}
