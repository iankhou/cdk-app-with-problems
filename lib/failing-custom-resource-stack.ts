import * as cdk from 'aws-cdk-lib/core';
import { CustomResource } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * A custom resource whose handler crashes BEFORE it ever responds to CloudFormation.
 *
 * On Create the handler throws immediately (it never calls cfn-response / writes to the
 * ResponseURL), so CloudFormation never receives a response and eventually fails the
 * resource itself. The resulting status reason is a generic CloudFormation timeout/failure
 * message — it contains NO cfn-response "CloudWatch Log Stream:" pointer and no handler
 * detail at all.
 *
 * This is the hardest case for diagnosis: the only record of what went wrong is the thrown
 * error in the function's CloudWatch logs. Surfacing it relies entirely on resolving the log
 * group and scanning the failure time window — there is no stream name in the reason to
 * target, and no FAILED response body to read.
 *
 * The function timeout is kept short so the crash surfaces quickly rather than waiting out
 * the default. On Update/Delete it responds SUCCESS so a rollback's Delete completes cleanly.
 */
export class FailingCustomResourceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new lambda.Function(this, 'CrHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(10),
      code: lambda.Code.fromInline([
        "const response = require('cfn-response');",
        "exports.handler = (event, context) => {",
        "  console.log('request type:', JSON.stringify(event.RequestType));",
        "  if (event.RequestType === 'Create') {",
        "    console.error('Boom: crashing before responding to CloudFormation');",
        "    // Throw without ever calling response.send(...) — CloudFormation gets no reply.",
        "    throw new Error('simulated unhandled error before responding');",
        "  }",
        "  response.send(event, context, response.SUCCESS, {});",
        "};",
      ].join('\n')),
    });

    new CustomResource(this, 'MyFailingResource', { serviceToken: fn.functionArn });
  }
}
