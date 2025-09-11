// Define capability hierarchies for ssh.*, http.*, file.*
export const SecurityCapabilities = {
  ssh: {
    exec: 'ssh.exec',
    fileTransfer: 'ssh.file-transfer',
  },
  http: {
    request: 'http.request',
    upload: 'http.upload',
  },
  file: {
    read: 'file.read',
    write: 'file.write',
  },
};

export default SecurityCapabilities;
