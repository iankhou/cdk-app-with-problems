import * as cdk from 'aws-cdk-lib/core';
import { CustomResource } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * A stack whose custom resource fails via the cfn-response library.
 *
 * On Create, the handler reports FAILED (cfn-response writes the failing log stream name
 * into the CloudFormation status reason). On Update/Delete it succeeds, so a rollback's
 * Delete completes cleanly and the stack is not left wedged.
 */
export class FailingCustomResourceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new lambda.Function(this, 'CrHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      loggingFormat: lambda.LoggingFormat.JSON,
      code: lambda.Code.fromInline([
        "const response = require('cfn-response');",
        "exports.handler = (event, context) => {",
        "  console.log('request type:', JSON.stringify(event.RequestType));",
        // "  if (event.RequestType === 'Create') {",
        "    console.error('Boom: simulated custom resource failure on Create');",
        "    response.send(event, context, response.FAILED, { error: 'simulated' });",
        "    return;",
        // "  }",
        // "  response.send(event, context, response.SUCCESS, {});",
        "};",
      ].join('\n')),
    });

    new CustomResource(this, 'MyFailingResource', { serviceToken: fn.functionArn });
  }
}
