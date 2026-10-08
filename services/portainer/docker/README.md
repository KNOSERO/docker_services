# Docker Compose Pack

## Config

```yaml
- name: Deploy
  hosts: SERWER
  become: yes

  vars:
    host_path: "{{ playbook_dir }}"
    server_dir: "{{ playbook_dir | basename }}"

  tasks:
    - name: Deploy Docker
      include_tasks: docker/playbook.yml
```

```ini
[SERWER]
{{SERWER}} ansible_host=={{IP}} ansible_user={{USER}} ansible_ssh_private_key_file=~/.ssh/id_home_lab
...

```