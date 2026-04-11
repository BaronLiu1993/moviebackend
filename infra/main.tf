terraform {
  required_version = ">= 1.5"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

# SSH key for accessing the droplet
resource "digitalocean_ssh_key" "deploy" {
  name       = "moviebackend-deploy"
  public_key = var.ssh_public_key
}

# The droplet
resource "digitalocean_droplet" "app" {
  name     = "moviebackend"
  region   = var.region
  size     = "s-1vcpu-2gb"
  image    = "docker-20-04"  # Docker pre-installed on Ubuntu 20.04

  ssh_keys = [digitalocean_ssh_key.deploy.fingerprint]

  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Install docker-compose v2
    apt-get update -y
    apt-get install -y docker-compose-plugin

    # Create app directory
    mkdir -p /opt/moviebackend
    chown root:root /opt/moviebackend
  EOF

  tags = ["moviebackend", "production"]
}

# Firewall: only allow SSH, HTTP, HTTPS
resource "digitalocean_firewall" "app" {
  name        = "moviebackend-fw"
  droplet_ids = [digitalocean_droplet.app.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# Outputs
output "droplet_ip" {
  value       = digitalocean_droplet.app.ipv4_address
  description = "Public IP of the droplet"
}

output "droplet_id" {
  value = digitalocean_droplet.app.id
}
