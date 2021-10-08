import React from 'react'
import detectEthereumProvider from '@metamask/detect-provider';
import ContractUtil from "./contractUtil";
import {
    Button,
    TextField,
    CircularProgress,
    DialogTitle,
    DialogContentText,
    DialogContent,
    DialogActions,
    Slide,
    Card,
    Dialog, Container, Grid,  Typography

} from '@material-ui/core';
import {withStyles} from "@material-ui/core";
import { checkAddressChecksum, base58Decode} from "@polkadot/util-crypto";




const useStyles = theme=>({
    root: {
        paddingTop: theme.spacing(10),
        minHeight: theme.spacing(120)
    },
    card:{
        padding: theme.spacing(4)
    },
    style_flex_center:{
        display:"flex",
        justifyContent:"center",
        alignItems:"center",
        // marginTop:theme.spacing(4)
    }
});
const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

class App extends React.Component {
    provider
    contractUtil
    constructor() {
        super();
        this.state = {
            currentAccount:"",
            targetNativeAddress:"",
            swapAmount:0,
            nmtBalance:0,
            alertMessage:"",
            approveDialogOpen:false,

            chainId:"0x4",
            isInstallMetaMask:true,
            approveTx:null,
            swapTx:null,
            commitSuccess:false,
            approveSuccess:false

        };
    }

    _isMainChain=()=>{
        return this.state.chainId === "0x4";
    }
    async componentDidMount(){
        this.provider = await detectEthereumProvider();

        if (this.provider) {
            this.contractUtil = new ContractUtil(this.provider);
            this.provider.on('chainChanged', this.handleChainChanged);
            this.provider.on('accountsChanged',this.handleAccountsChanged);
            this.setState({chainId:  await this.provider.request({ method: 'eth_chainId' })});
            await this.requestAccount();

            if(this._isMainChain()) {
                console.info(this.state.currentAccount)
                if (this.state.currentAccount) {
                    this.setState({approveTx: this._localGet("approveTx"),swapTx: this._localGet("swapTx")})

                this._checkApproveTx();
                this._checkSwapTx();
                let nmtBalance = await this.contractUtil.NMTBalance(this.state.currentAccount);
                this.setState({nmtBalance: nmtBalance});
                }
            }
        } else {
            this.setState({isInstallMetaMask:false})
            console.log('Please install MetaMask!');
        }
    }
    requestAccount = async ()=>{
        let accounts = await this.provider.request({ method: 'eth_requestAccounts' });
        await this.handleAccountsChanged(accounts);
    }
    _localSave=(key,value)=>{
        localStorage.setItem(this.state.currentAccount + "_" + key,value);
    }
    _localGet=(key)=>{
        return localStorage.getItem(this.state.currentAccount + "_" + key);
    }
    _localRemove=(key)=>{
        return localStorage.removeItem(this.state.currentAccount + "_" + key);
    }

    handleApprove = async ()=>{

        try{
            var tx = await this.contractUtil.NMTapproveAll();
            this.setState({approveTx:tx.hash,approveDialogOpen:false});
            // tx.gt
            this._localSave("approveTx",tx.hash);
            this._checkApproveTx();

        }catch(err){
            this.handleApproveDialogClose();
            console.error(err);
        }
    }
    handleApproveDialogClose = ()=>{
        this.setState({approveDialogOpen:false});
    }
    _checkApproveTx = ()=>{
        if(this.state.approveTx!==null) {
            this.contractUtil.provider.waitForTransaction(this.state.approveTx, 1).then((txr) => {
                if (txr.status === 0) {
                    this.setState({alertMessage:"Transaction Error, Please Check it"});
                }
                this.setState({approveTx: null,approveSuccess:true});
                this._localRemove("approveTx");
            });
        }
    }
    _handleSwithChain = async() =>{
        try {
            await this.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x4' }],
            });
        } catch (switchError) {
            console.info(switchError);
        }
    }
    _handleConnectClick=async ()=>{
        if(!this.provider){
            this.setState({alertMessage:"Please Install MetaMask First"});
            return;
        }
        if(!this._isMainChain()){
            this.setState({alertMessage:"Please Select Ethereum Main Network First"})
            return ;
        }
        this.requestAccount();
    }
    handleChainChanged=(_chainId)=> {
        window.location.reload();
        // this.setState({chainId:_chainId});
    }
    handleAccountsChanged=async (accounts)=>{
        if(accounts[0]) {
            this.setState({currentAccount: accounts[0]});
            if(this._isMainChain()) {
                let nmtBalance = await this.contractUtil.NMTBalance(this.state.currentAccount);
                this.setState({nmtBalance: nmtBalance});
            }
        }else{
            this.setState({currentAccount: ""});
        }
    }
    handleAmountChange = async (event)=>{
        this.setState({swapAmount:event.target.value})
    }
    handleNativeChange = async(event)=>{
        this.setState({targetNativeAddress: event.target.value})
    }

    _checkSwapTx = ()=>{
        if(this.state.swapTx!==null) {
            this.contractUtil.provider.waitForTransaction(this.state.swapTx, 1).then((txr) => {
                if (txr.status === 0) {
                    this.alertMessage("Transaction Error, Please Check it")
                }
                this.setState({swapTx: null,commitSuccess:true,approveSuccess:false});
                this._localRemove("swapTx");
            });
        }
    }

    handleSwap=async ()=>{
        if(!this._isMainChain()){
            this.setState({alertMessage:"Please Select Ethereum Main Network First"});
            return ;
        }
        //地址对不对
        let isValid;
        try {
            [isValid] = checkAddressChecksum(base58Decode(this.state.targetNativeAddress));
        }catch (e) {
            isValid = false;
        }
        if(!isValid){
            this.setState({alertMessage:"Please check you Native Address"});
            return;
        }
        if(this.state.swapAmount > this.state.nmtBalance){
            this.setState({alertMessage:"Insufficient NMT balance"});
            return;
        }
        if(! await this.contractUtil.isNMTAllowanceEnough(this.state.currentAccount,this.state.swapAmount)){
            this.setState({approveDialogOpen:true})
        }else{
            try {
                var swapTx =  await this.contractUtil.erc20toNative(this.state.targetNativeAddress,this.state.swapAmount);

                this.setState({swapTx: swapTx.hash ,approveSuccess:false});
                // tx.gt
                this._localSave("swapTx", swapTx.hash);
                this._checkSwapTx();
            }catch(err){
                console.error(err);
            }
        }
    }
    _handleClearApproveTx = ()=>{

        this._localRemove("approveTx")
        this.setState({approveTx:null});
    }
    _handleClearSwapTx = ()=>{
        this._localRemove("swapTx");
        this.setState({swapTx:null});
    }

  render() {
        const { classes } = this.props;
        return (
            <React.Fragment>
            <Container maxWidth="sm" className={classes.root} >
                <Card className={classes.card} variant="outlined">
                <Grid container spacing={3}>
                    {!this.state.isInstallMetaMask &&
                    <Grid container className={classes.style_flex_center}>
                        <a href={"https://metamask.io/download.html"} rel={"noreferrer"} target="_blank"
                           style={{textDecoration: "none"}}>
                            <Button
                                variant="contained"
                                size={"large"}
                                color={"secondary"}
                            >Please click and install MetaMask!  https://metamask.io/download.html</Button>
                        </a>
                    </Grid>
                    }
                    {this.state.chainId!=="0x4" &&
                    <Grid container className={classes.style_flex_center}>
                        <Button
                            onClick={this._handleSwithChain}
                            variant={"contained"}
                            size={"large"}
                            color={"secondary"}
                        >
                            Click And Switch Ethereum Main Network
                        </Button>

                    </Grid>
                    }
                    <Grid item xs={12} className={classes.style_flex_center}>
                        <Typography variant={"h5"} style={{paddingBottom:"20px"}}>NMT ERC20 to Native</Typography>
                    </Grid>

                    <Grid item xs={12} className={classes.style_flex_center}>
                        {this.state.currentAccount!==""?
                            <TextField disabled={true} fullWidth  id="outlined-basic" label="From ERC20 Address" variant="outlined" value={this.state.currentAccount}/>
                            :<Button variant="contained" color="secondary" size={"large"} onClick={this._handleConnectClick}>Connect Wallet</Button>
                        }
                    </Grid>
                    <Grid item xs={12}>
                        <TextField disabled={this.state.currentAccount===""} id="outlined-basic" fullWidth label="To Native Address" variant="outlined"
                                   onChange={this.handleNativeChange}

                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField disabled={this.state.currentAccount===""} id="outlined-basic" fullWidth label="Swap Amount" variant="outlined"
                                   placeholder={this.state.nmtBalance.toString()}
                                   type="number"
                                   onChange={this.handleAmountChange}
                        />
                    </Grid>
                    <Grid item xs={12} className={classes.style_flex_center}>
                        <Button variant="contained" color="secondary" onClick={this.handleSwap} disabled={this.state.currentAccount==="" || this.state.swapAmount<1 || this.state.targetNativeAddress===""  } size={"large"}>Swap</Button>
                    </Grid>
                    <Grid item xs={12} className={classes.style_flex_center}>
                        {this.state.approveTx &&
                        <Grid item xs={12} className={classes.style_flex_center}>
                            <CircularProgress color={"inherit"} size={20}/>
                            <br/>
                            <Grid>&nbsp;&nbsp;Tx:&nbsp;&nbsp; <a target={"_blank"} rel="noreferrer" href={"https://etherscan.io/tx/"+ this.state.approveTx} >{
                                this.state.approveTx.substring(0,15)+"..."
                            } </a></Grid>
                            &nbsp;
                            <Button size={"small"} variant={"outlined"}  onClick={this._handleClearApproveTx}>clear</Button>
                        </Grid>
                        }
                        {this.state.swapTx &&
                        <Grid item xs={12}  className={classes.style_flex_center}>
                            <CircularProgress color={"inherit"} size={20}/><br/>
                            <Grid>&nbsp;&nbsp;Tx:&nbsp;&nbsp;<a  rel="noreferrer"  href={"https://etherscan.io/tx/"+ this.state.swapTx} target={"_blank"}> {
                                this.state.swapTx.substring(0,15)+"..."
                            }</a></Grid>&nbsp;
                            <Button size={"small"} variant={"outlined"}  onClick={this._handleClearSwapTx}>clear</Button>
                        </Grid>
                        }

                        {this.state.commitSuccess &&
                        <Grid item xs={12}  className={classes.style_flex_center}>
                            <Typography variant={"h6"}> Commit Success </Typography>
                        </Grid>
                        }

                        {this.state.approveSuccess &&
                        <Grid item xs={12}  className={classes.style_flex_center}>
                            <Typography variant={"h6"}> Approve Success </Typography>
                        </Grid>
                        }

                    </Grid>
                </Grid>
                </Card>
            </Container>

      <Dialog
          open={this.state.alertMessage!==""}
          onClose={()=>{this.setState({alertMessage:""})}}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
      >
          <DialogContent>
              <DialogContentText id="alert-dialog-description">
                  {this.state.alertMessage}
              </DialogContentText>
          </DialogContent>
          <DialogActions>
              <Button onClick={()=>{this.setState({alertMessage:""})}} color="primary" autoFocus>
                  Ok
              </Button>
          </DialogActions>
      </Dialog>

                <Dialog
                    open={this.state.approveDialogOpen}
                    TransitionComponent={Transition}
                    keepMounted
                    onClose={this.handleApproveDialogClose}
                    aria-labelledby="alert-dialog-slide-title"
                    aria-describedby="alert-dialog-slide-description"
                >
                    <DialogTitle id="alert-dialog-slide-title">Approve Confirm</DialogTitle>
                    <DialogContent>
                        <DialogContentText id="alert-dialog-slide-description">
                            Please approve NMTSwap contract transfer NMT.
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={this.handleApproveDialogClose} color="primary">
                            Reject
                        </Button>
                        <Button onClick={this.handleApprove} color="primary">
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>
            </React.Fragment>
    );
  }

}

export default withStyles(useStyles)(App);
