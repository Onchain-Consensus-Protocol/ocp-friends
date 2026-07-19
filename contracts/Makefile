RPC_URL ?= https://sepolia.base.org
EXPECTED_CHAIN_ID ?= 84532
ACCOUNT ?= deployer
BLOCKSCOUT_API_URL ?= https://base-sepolia.blockscout.com/api/

.PHONY: test build deploy clean

test:
	forge test

build:
	forge build

deploy:
	@test "$$(cast chain-id --rpc-url "$(RPC_URL)")" = "$(EXPECTED_CHAIN_ID)" || (echo "Unexpected RPC chain"; exit 1)
	forge script script/DeployPrivateVaultFactory.s.sol:DeployPrivateVaultFactoryScript \
		--rpc-url "$(RPC_URL)" --account "$(ACCOUNT)" --broadcast --verify \
		--verifier blockscout --verifier-url "$(BLOCKSCOUT_API_URL)"

clean:
	forge clean
