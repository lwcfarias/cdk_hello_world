import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc, IpAddresses, SubnetType, InterfaceVpcEndpointAwsService, GatewayVpcEndpointAwsService} from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService,  } from 'aws-cdk-lib/aws-ecs-patterns';
import { HostedZone } from 'aws-cdk-lib/aws-route53';

export class CdkStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const vpc = new Vpc(this, 'Vpc', {
			ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
			maxAzs: 2,
			vpcName: 'vpc-hello-world',
			natGateways: 0,
			gatewayEndpoints: {
				S3: {
				  service: GatewayVpcEndpointAwsService.S3,
				}
			},

		});
		
		// needed for AWS services access from isolated subnet
		vpc.addInterfaceEndpoint('LogsVpcEndpoint', {
			service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,	  
		});

		vpc.addInterfaceEndpoint('EcrVpcEndpoint', {
			service: InterfaceVpcEndpointAwsService.ECR,	  
		});

		vpc.addInterfaceEndpoint('EcrDockerVpcEndpoint', {
			service: InterfaceVpcEndpointAwsService.ECR_DOCKER,	  
		});
		const cluster = new Cluster(this, 'Cluster', {
			vpc: vpc,
			clusterName: 'cluster-hello-world'
		});
		
/*		const myHostedZone = new HostedZone(this, 'HostedZone', {
			zoneName: 'codelitz.com',
		});
*/		
		const loadBalancedFargateService = new ApplicationLoadBalancedFargateService(this, 'Service', {
			cluster,
			
			memoryLimitMiB: 512,
			cpu: 256,
			taskImageOptions: {
				image: ContainerImage.fromAsset('../'),
				containerPort:80
			},
			circuitBreaker: {rollback: true},
			desiredCount: 1,
			domainName: 'hello-world.codelitz.com',
			domainZone: HostedZone.fromLookup(this, 'HostedZone', {domainName: 'codelitz.com'}),
			maxHealthyPercent: 200,
			minHealthyPercent: 100,
			serviceName:'hello-world',
			taskSubnets: {
				onePerAz: true,
				subnetType: SubnetType.PRIVATE_ISOLATED,
			}
			
		});

		loadBalancedFargateService.targetGroup.configureHealthCheck({
			path: "/actuator/health",
			port: '80'
		});
	}
}
