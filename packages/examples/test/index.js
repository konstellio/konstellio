const { FileSystemFTP } = require('@konstellio/fs-ftp');
const { FileSystemSFTP } = require('@konstellio/fs-sftp');

(async () => {
    const conn = new FileSystemFTP({
        host: '',
        port: 21,
        user: '',
        password: '',
        secure: true,
        secureOptions: {
            rejectUnauthorized: false
        },
        debug(msg) {
            console.info(msg);
        }
    });

    console.log(await conn.readDirectory(''));
})();