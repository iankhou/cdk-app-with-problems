import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * A stack that fails WITHOUT any custom resource: a VPC-attached Lambda whose execution
 * role cannot create ENIs.
 *
 * This is the generic case CloudTrail-based diagnosis exists for. The denied call
 * (`ec2:CreateNetworkInterface`) is made by the *Lambda service* on the function's behalf,
 * assuming the execution role under a service-generated session name (e.g.
 * `awslambda_320_20260706195548513`) — so no per-resource CloudTrail filter could ever be
 * computed for it; only a window sweep correlated by the role's identity finds it.
 *
 * CDK's Lambda construct normally attaches AWSLambdaVPCAccessExecutionRole automatically
 * when vpc is set, so we build the role by hand with only the basic logging policy.
 */
export class VpcEniDeniedStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const role = new iam.Role(this, 'VpcFnRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      // Intentionally only logs permissions — NOT AWSLambdaVPCAccessExecutionRole, so the
      // Lambda service is denied ec2:CreateNetworkInterface when wiring the function into
      // the VPC.
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    new lambda.Function(this, 'VpcFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      role,
      vpc,
      allowPublicSubnet: true,
      code: lambda.Code.fromInline("exports.handler = async () => 'ok';"),
    });
  }
}
