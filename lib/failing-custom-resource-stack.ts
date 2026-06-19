import * as cdk from 'aws-cdk-lib/core';
import { CustomResource } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * A stack whose custom resource fails via the cfn-response library.
 *
 * On Create, the handler reports FAILED (cfn-response writes the failing log stream name
 * into the CloudFormation status reason). On Update/Delete it succeeds, so a rollback's
 * Delete completes cleanly and the stack is not left wedged.
 *
 * The backing Lambda uses advanced logging controls: an explicit custom CloudWatch
 * LogGroup (sets the function's LoggingConfig.LogGroup), so it does NOT log to the default
 * /aws/lambda/<function-name> group. This exercises the diagnostics' template-sourced
 * log-group resolution, which must find the configured group without calling
 * getFunctionConfiguration on the (rolled-back, deleted) function.
 */
export class FailingCustomResourceAdvancedLoggingStack2 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Custom log group (advanced logging controls). RETAIN so the logs survive the rollback
    // that deletes the rest of the stack — otherwise the failure logs would be gone.
    const logGroup = new logs.LogGroup(this, 'CrHandlerLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const fn = new lambda.Function(this, 'CrHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      logGroup,
      code: lambda.Code.fromInline([
        "const response = require('cfn-response');",
        "exports.handler = (event, context) => {",
        "  console.log('request type:', JSON.stringify(event.RequestType));",
        "  if (event.RequestType === 'Create') {",
        "    console.error('Boom: simulated custom resource failure on Create (advanced logging variant)');",
        "    response.send(event, context, response.FAILED, { error: 'simulated-advanced-logging' });",
        "    return;",
        "  }",
        "  response.send(event, context, response.SUCCESS, {});",
        "};",
      ].join('\n')),
    });

    new CustomResource(this, 'MyFailingResource', { serviceToken: fn.functionArn });
  }
}
