let braintree = require("braintree");

module.exports.getToken = async (event) => {
  const gateway = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId: process.env.SANDBOX_MERCHANTID,
    publicKey: process.env.SANDBOX_PUBLICKEY,
    privateKey: process.env.SANDBOX_PRIVATEKEY
  });

  console.log('Braintree Developer API');

  console.log("event.body ", event.body);
  
  const params = JSON.parse(event.body);
  console.log('JSON.parse(event.body) --> ', params);
  const amount = params.amount != null &&  params.amount != '' ? params.amount : '';
  
  let newTransaction = null;
  let refundableAmount = 0.00;
  let previousRefundedAmount = 0.00;
  let isFindTransaction = false;
  let errorFound = false;
  let transactionStatus = '';

  if(params.hasOwnProperty('braintreeTransactionId')){
    
    console.log('Transaction find according Transaction Id......');
    console.log('braintreeTransactionId in searching : ', params.braintreeTransactionId);
    isFindTransaction = true;
    try{
      newTransaction = await gateway.transaction.find(params.braintreeTransactionId);
      console.log('serachedTransaction ', newTransaction); 
      transactionStatus = newTransaction.status;

      if(newTransaction.status == 'settled' || newTransaction.status == 'settling'){  
        let totalTransactionAmount = newTransaction.amount;
        let refundIds = newTransaction.refundIds;
        previousRefundedAmount = 0.00;
        
        for(let index in refundIds){
          let refundedTransaction = await gateway.transaction.find(refundIds[index]);
          previousRefundedAmount +=  parseFloat(refundedTransaction.amount);
        };

        console.log('total previousRefundedAmount ', previousRefundedAmount);
        refundableAmount = parseFloat(totalTransactionAmount) - previousRefundedAmount;
      }else if(newTransaction.status == 'voided'){
           console.log('void status execute ', newTransaction.status);
           previousRefundedAmount = newTransaction.amount;
           refundableAmount = 0.00;
      }else if(newTransaction.status == 'authorized' || newTransaction.status == 'submitted_for_settlement' || newTransaction.status ==  'settlement_pending'){
       //if(newTransaction.status == 'authorized' || newTransaction.status == 'submitted_for_settlement' || newTransaction.status ==  'settlement_pending'){
          console.log('settlement pending status execute ', newTransaction.status);
          previousRefundedAmount = 0.00;
          refundableAmount = newTransaction.amount;
      }else{
        console.log('Transaction have other Status ', newTransaction.status);
        previousRefundedAmount = 0.00;
        refundableAmount = 0.00;
      }

      console.log('refundableAmount ', refundableAmount);
      console.log('Braintree Searching End');  
    }catch (error) {
      errorFound = true;
      console.log('error : ',error);
      console.log('error type : ',error.type);
    }
      
  }
  

  console.log('newTransaction : ', newTransaction);

  if(newTransaction != null && (newTransaction.success || isFindTransaction)){
    console.log('Transaction Success.... Build Response');
    if(isFindTransaction){
      //if we find the transaction then response body should have refundableAmount, previousRefundedAmount 
      console.log('Find Transaction Response Details');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ 
          status: 'OK', 
          refundedAmount : 0.00,
          refundableAmount : refundableAmount,
          previousRefundedAmount : previousRefundedAmount,
          refundedTransactionId : '', 
          transactionStatus : transactionStatus,
          result: newTransaction ? JSON.stringify(newTransaction) : ''
        })
      };

    }
  }else if(errorFound || (newTransaction != null && !newTransaction.success)){
    console.log('Transaction Error.... Error Response');
    //Error Response
    // If API is success is false.
    return {
      statusCode: 400,  //Bad Request
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ status: 'ERROR', result: "Braintree Error" })
    }; 
  }else{
    console.log('Transaction Pending.... Pending Response.... Braintree API is not called');
    //Pending Response  
    // If API is success is false.
    return {
      statusCode: 404,  //Braintree Response Not Found
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ status: 'PENDING', result: "Internal Error" })
    };
  }
};