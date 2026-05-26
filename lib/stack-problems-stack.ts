import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class ImagePullFailureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {});

    taskDefinition.addContainer('DefaultContainer', {
      // Nonexistent image tag to trigger CannotPullContainerError
      image: ecs.ContainerImage.fromRegistry('229816860325.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-229816860325-us-east-1:nonexistent-tag-that-does-not-exist'),
      memoryLimitMiB: 512,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'app',
      }),
    });

    new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      circuitBreaker: { enable: true },
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
  }
}
