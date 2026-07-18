RPC_URL ?= https://mainnet.base.org

.PHONY: test build deploy clean

test:
	forge test

build:
	forge build

deploy:
	@test -n "$$PRIVATE_KEY" || (echo "Set PRIVATE_KEY in the environment"; exit 1)
	forge script script/DeployPrivateVaultFactory.s.sol:DeployPrivateVaultFactoryScript \
		--rpc-url "$(RPC_URL)" --broadcast

clean:
	forge clean
