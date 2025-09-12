export default [
  {
    id: 'k8s-prod-cluster',
    name: 'Production Kubernetes Cluster',
    type: 'kubernetes',
    enabled: true,
    group: 'kubernetes',
    metadata: {
      description: 'Main production Kubernetes cluster',
      version: 'v1.28.2',
      environment: 'production',
      owner: 'platform-team',
      region: 'us-west-2'
    },
    connection: {
      url: 'https://k8s-api.prod.example.com',
      protocol: 'https',
      timeout: 60000
    },
    security: {
      authentication: {
        type: 'certificate',
        certificatePath: '~/.kube/prod-cluster.pem',
        keyPath: '~/.kube/prod-cluster-key.pem'
      },
      authorization: {
        enabled: true,
        roles: ['cluster-admin'],
        policies: [
          {
            action: 'get',
            resource: 'pods',
            effect: 'allow'
          },
          {
            action: 'create',
            resource: 'deployments',
            effect: 'allow'
          }
        ]
      }
    },
    tags: ['kubernetes', 'production', 'container-orchestration']
  },
  {
    id: 'k8s-dev-cluster',
    name: 'Development Kubernetes Cluster',
    type: 'kubernetes',
    enabled: true,
    group: 'kubernetes',
    metadata: {
      description: 'Development and testing Kubernetes cluster',
      version: 'v1.27.5',
      environment: 'development'
    },
    connection: {
      url: 'https://k8s-dev.example.com',
      protocol: 'https'
    },
    security: {
      authentication: {
        type: 'token',
        credentials: {
          token: '${K8S_DEV_TOKEN}'
        }
      }
    },
    tags: ['kubernetes', 'development', 'testing']
  }
];