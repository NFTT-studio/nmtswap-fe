import { ethers } from "ethers"

const SWAP_ADDRESS ="0xFD43a372b6A900AB05f5ddccb0C6298B2D0469AB"
const NMT_ADDRESS ="0x4373A302B3Fd99d91E9eF540f200FdCd856Fbb73"

class   ContractUtil{
    provider
    // contract
    constructor(connect) {
        this.provider = new ethers.providers.Web3Provider(connect,"any")
        // this.contract = new ethers.Contract(SWAP_ADDRESS,this.abi,this.provider);
    }

    isNMTAllowanceEnough=async (owner,amount)=>{
        const allowanceAbi = [
            "function allowance(address owner, address spender) external view returns (uint256)"
        ];
        const contract = new ethers.Contract(NMT_ADDRESS, allowanceAbi, this.provider);
        const allowance = await contract.allowance(owner,SWAP_ADDRESS);
        return parseInt(ethers.utils.formatEther( allowance)) >parseInt( amount);
    }

    isNMTBalanceEnough=async (owner,amount)=>{

        return (await this.NMTBalance(owner)) >= parseInt( amount);
    }

    NMTBalance=async (owner)=>{
        const balanceOfabi = [
            "function balanceOf(address) view returns (uint)"
        ];
        const contract = new ethers.Contract(NMT_ADDRESS, balanceOfabi, this.provider);
        const balance = await contract.balanceOf(owner);
        return parseInt(ethers.utils.formatEther( balance))
    }

    NMTapproveAll=async()=>{
        const approveAbi = [
            "function approve(address spender, uint256 amount) external returns (bool)"
        ];
        const contract = new ethers.Contract(NMT_ADDRESS, approveAbi, this.provider);
        const signer = this.provider.getSigner()
        let tx = await contract.connect(signer).approve(SWAP_ADDRESS, "10000000000000000000000000");
        return tx;
    }

    erc20toNative=async(nativeAddress,amount)=>{

        const swapAbi = [
            "function erc20toNative(string memory nativeAddress,uint256 amount) public returns (bool)"
        ];
        const contract = new ethers.Contract(SWAP_ADDRESS, swapAbi, this.provider);
        const signer = this.provider.getSigner();

        let tx = await contract.connect(signer).erc20toNative(nativeAddress,ethers.utils.parseUnits(amount).toString());
        return tx;
    }
}
export default ContractUtil;