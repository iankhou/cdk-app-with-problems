import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';

export class StackProblemsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {});

    taskDefinition.addContainer('DefaultContainer', {
      image: ecs.ContainerImage.fromAsset(`${__dirname}/image`, {
        platform: Platform.LINUX_AMD64,
      }),
      memoryLimitMiB: 512,
      portMappings: [{ containerPort: 8080 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'app',
      }),
    });

    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      circuitBreaker: { enable: true },
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // ALB with health check that will fail (app doesn't serve HTTP)
    const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true,
    });

    const listener = lb.addListener('Listener', { port: 80 });
    listener.addTargets('Target', {
      port: 8080,
      targets: [service],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });
  }
}
