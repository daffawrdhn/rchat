# XOXO Chat — Surge Client

## Deploy

```bash
# install surge
npm install -g surge

# deploy dari folder surge/
surge surge/ https://xoxo-chat.surge.sh
```

## Update Allowed Origins (SSH)

```bash
sudo nano /var/www/rchat/.env
# tambah: surge.sh
sudo systemctl restart xoxo-server
```
