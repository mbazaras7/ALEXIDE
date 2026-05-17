import Docker from 'dockerode';

let _docker: Docker | null = null;

export function getDocker(): Docker {
  if (!_docker) {
    _docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }
  return _docker;
}

export default getDocker();
